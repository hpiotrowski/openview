import os
import sys
import time
from typing import List, Optional
import numpy as np
import pandas as pd
import requests
import torch
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Ensure model module is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from model import Kronos, KronosTokenizer
from model.kronos import calc_time_stamps, sample_from_logits

app = FastAPI(
    title="OpenView Kronos AI Service",
    description="Statistical Foundation Model for K-line Financial Forecasting",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model state & in-memory cache
tokenizer: Optional[KronosTokenizer] = None
model: Optional[Kronos] = None
device: str = "cpu"
forecast_cache = {}

def get_cached_forecast(key: str, max_age: float = 90.0):
    if key in forecast_cache:
        data, ts = forecast_cache[key]
        if time.time() - ts < max_age:
            return data
    return None

def set_cached_forecast(key: str, data: dict):
    forecast_cache[key] = (data, time.time())

@app.on_event("startup")
def load_models():
    global tokenizer, model, device
    print("⏳ Loading Kronos Foundation Model...")
    
    if torch.cuda.is_available():
        device = "cuda:0"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
        try:
            torch.set_num_threads(4)
            print("🧵 Set PyTorch CPU threads to 4 for optimal throughput")
        except Exception:
            pass
    print(f"💻 Selected compute device: {device}")

    try:
        tokenizer = KronosTokenizer.from_pretrained("NeoQuasar/Kronos-Tokenizer-base")
        model = Kronos.from_pretrained("NeoQuasar/Kronos-base")
        tokenizer.to(device)
        model.to(device)
        tokenizer.eval()
        model.eval()
        print("✅ Kronos Model and Tokenizer loaded and ready!")
    except Exception as e:
        print(f"❌ Error loading Kronos model: {e}")
        raise e

def run_kronos_inference(
    df: pd.DataFrame,
    timestamps: pd.Series,
    pred_len: int = 24,
    sample_count: int = 5,
    temperature: float = 0.8,
    top_p: float = 0.9,
    max_context: int = 512,
    clip: float = 5.0
):
    global tokenizer, model, device
    if model is None or tokenizer is None:
        raise RuntimeError("Model not initialized")

    price_cols = ["open", "high", "low", "close"]
    vol_cols = ["volume", "amount"]
    time_cols = ["minute", "hour", "weekday", "day", "month"]

    # 1. Prepare context
    x = df[price_cols + vol_cols].values
    x_mean = np.mean(x, axis=0)
    x_std = np.std(x, axis=0)
    x_norm = (x - x_mean) / (x_std + 1e-5)

    # 2. Time encoding
    last_dt = timestamps.iloc[-1]
    # Infer frequency from last 2 bars
    diff = timestamps.iloc[-1] - timestamps.iloc[-2]
    future_timestamps = pd.Series([last_dt + (i + 1) * diff for i in range(pred_len)])
    
    x_time_df = calc_time_stamps(timestamps)
    y_time_df = calc_time_stamps(future_timestamps)

    x_stamp = x_time_df[time_cols].values
    y_stamp = y_time_df[time_cols].values

    # 3. Convert to torch
    x_t = torch.from_numpy(x_norm[np.newaxis, :]).float()
    x_stamp_t = torch.from_numpy(x_stamp[np.newaxis, :]).long()
    y_stamp_t = torch.from_numpy(y_stamp[np.newaxis, :]).long()

    with torch.no_grad():
        x_clipped = torch.clip(x_t, -clip, clip)
        x_exp = x_clipped.unsqueeze(1).repeat(1, sample_count, 1, 1).reshape(-1, x_clipped.size(1), x_clipped.size(2)).to(device)
        x_stamp_exp = x_stamp_t.unsqueeze(1).repeat(1, sample_count, 1, 1).reshape(-1, x_stamp_t.size(1), x_stamp_t.size(2)).to(device)
        y_stamp_exp = y_stamp_t.unsqueeze(1).repeat(1, sample_count, 1, 1).reshape(-1, y_stamp_t.size(1), y_stamp_t.size(2)).to(device)

        x_token = tokenizer.encode(x_exp, half=True)
        initial_seq_len = x_exp.size(1)
        batch_size = x_token[0].size(0)
        total_seq_len = initial_seq_len + pred_len
        full_stamp = torch.cat([x_stamp_exp, y_stamp_exp], dim=1)

        generated_pre = x_token[0].new_empty(batch_size, pred_len)
        generated_post = x_token[1].new_empty(batch_size, pred_len)

        pre_buffer = x_token[0].new_zeros(batch_size, max_context)
        post_buffer = x_token[1].new_zeros(batch_size, max_context)
        buffer_len = min(initial_seq_len, max_context)
        if buffer_len > 0:
            start_idx = max(0, initial_seq_len - max_context)
            pre_buffer[:, :buffer_len] = x_token[0][:, start_idx:start_idx + buffer_len]
            post_buffer[:, :buffer_len] = x_token[1][:, start_idx:start_idx + buffer_len]

        for i in range(pred_len):
            current_seq_len = initial_seq_len + i
            if current_seq_len <= max_context:
                input_tokens = [
                    pre_buffer[:, :current_seq_len],
                    post_buffer[:, :current_seq_len]
                ]
            else:
                input_tokens = [pre_buffer, post_buffer]

            context_end = current_seq_len
            context_start = max(0, context_end - max_context)
            current_stamp = full_stamp[:, context_start:context_end, :].contiguous()

            s1_logits, context = model.decode_s1(input_tokens[0], input_tokens[1], current_stamp)
            s1_logits = s1_logits[:, -1, :]
            sample_pre = sample_from_logits(s1_logits, temperature=temperature, top_k=0, top_p=top_p, sample_logits=True)

            s2_logits = model.decode_s2(context, sample_pre)
            s2_logits = s2_logits[:, -1, :]
            sample_post = sample_from_logits(s2_logits, temperature=temperature, top_k=0, top_p=top_p, sample_logits=True)

            generated_pre[:, i] = sample_pre.squeeze(-1)
            generated_post[:, i] = sample_post.squeeze(-1)

            if current_seq_len < max_context:
                pre_buffer[:, current_seq_len] = sample_pre.squeeze(-1)
                post_buffer[:, current_seq_len] = sample_post.squeeze(-1)
            else:
                pre_buffer.copy_(torch.roll(pre_buffer, shifts=-1, dims=1))
                post_buffer.copy_(torch.roll(post_buffer, shifts=-1, dims=1))
                pre_buffer[:, -1] = sample_pre.squeeze(-1)
                post_buffer[:, -1] = sample_post.squeeze(-1)

        full_pre = torch.cat([x_token[0], generated_pre], dim=1)
        full_post = torch.cat([x_token[1], generated_post], dim=1)

        context_start = max(0, total_seq_len - max_context)
        input_tokens = [
            full_pre[:, context_start:total_seq_len].contiguous(),
            full_post[:, context_start:total_seq_len].contiguous()
        ]
        z = tokenizer.decode(input_tokens, half=True)
        z = z.reshape(1, sample_count, z.size(1), z.size(2))
        preds = z.cpu().numpy()

        # Unscale only the predicted future slice (last pred_len bars)
        sample_preds = preds[0, :, -pred_len:, :] * (x_std + 1e-5) + x_mean

    start_price = float(df["close"].iloc[-1])
    sample_close_paths = []
    end_prices = []

    for s in range(sample_count):
        closes = [float(val) for val in sample_preds[s, :, 3]]
        sample_close_paths.append(closes)
        end_prices.append(closes[-1])

    mean_close_path = [float(val) for val in np.mean(sample_preds[:, :, 3], axis=0)]
    pred_final_price = float(mean_close_path[-1])
    drift_pct = float(((pred_final_price - start_price) / start_price) * 100)

    envelope_low = float(np.min(sample_preds[:, :, 2])) # lowest low across all samples
    envelope_high = float(np.max(sample_preds[:, :, 1])) # highest high across all samples

    bullish_samples = sum(1 for p in end_prices if p > start_price)
    bearish_samples = sum(1 for p in end_prices if p < start_price)
    bullish_prob = float(bullish_samples / sample_count)

    # Direction determination:
    # Requires significant drift (|drift| >= 0.5%) and majority Monte Carlo consensus (>= 60%)
    if drift_pct >= 0.5 and bullish_prob >= 0.6:
        direction = "BULLISH"
        confidence = int(bullish_prob * 100)
    elif drift_pct <= -0.5 and (bearish_samples / sample_count) >= 0.6:
        direction = "BEARISH"
        confidence = int((bearish_samples / sample_count) * 100)
    else:
        direction = "NEUTRAL"
        confidence = int(max(bullish_prob, 1 - bullish_prob) * 100)

    future_times_ms = [int(ts.timestamp() * 1000) for ts in future_timestamps]

    return {
        "symbol": df.attrs.get("symbol", "UNKNOWN"),
        "interval": df.attrs.get("interval", "1h"),
        "start_price": start_price,
        "pred_final_price": pred_final_price,
        "drift_pct": round(drift_pct, 2),
        "direction": direction,
        "confidence": confidence,
        "bullish_probability": round(bullish_prob, 2),
        "envelope_low": round(envelope_low, 2),
        "envelope_high": round(envelope_high, 2),
        "timestamps": future_times_ms,
        "mean_path": [round(p, 2) for p in mean_close_path],
        "sample_paths": [[round(p, 2) for p in path] for path in sample_close_paths],
    }

def fetch_binance_klines(symbol: str, interval: str = "1h", limit: int = 400) -> pd.DataFrame:
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval={interval}&limit={limit}"
    res = requests.get(url, timeout=10)
    res.raise_for_status()
    raw = res.json()

    rows = []
    for item in raw:
        rows.append({
            "timestamps": pd.to_datetime(item[0], unit="ms"),
            "open": float(item[1]),
            "high": float(item[2]),
            "low": float(item[3]),
            "close": float(item[4]),
            "volume": float(item[5]),
            "amount": float(item[7]),
        })
    df = pd.DataFrame(rows)
    df.attrs["symbol"] = symbol
    df.attrs["interval"] = interval
    return df

class CandleItem(BaseModel):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    amount: Optional[float] = None

class ForecastRequest(BaseModel):
    symbol: str = "BTCUSDT"
    interval: str = "1h"
    steps: int = 24
    sample_count: int = 5
    candles: Optional[List[CandleItem]] = None

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "openview-kronos",
        "model": "Kronos-base",
        "device": device,
        "ready": model is not None and tokenizer is not None
    }

@app.get("/forecast")
def get_forecast(
    symbol: str = Query("BTCUSDT", description="Binance symbol e.g. BTCUSDT"),
    interval: str = Query("1h", description="Candle interval e.g. 15m, 1h, 4h"),
    steps: int = Query(8, ge=4, le=72, description="Number of bars to predict"),
    samples: int = Query(2, ge=1, le=10, description="Monte Carlo sample count")
):
    try:
        cache_key = f"{symbol.upper()}_{interval}_{steps}_{samples}"
        cached = get_cached_forecast(cache_key, max_age=90.0)
        if cached:
            cached_copy = dict(cached)
            cached_copy["cached"] = True
            return cached_copy

        t0 = time.time()
        # 96 bars = 24h on 15m, perfect context without quadratic attention lag
        df = fetch_binance_klines(symbol, interval, limit=96)
        result = run_kronos_inference(
            df=df,
            timestamps=df["timestamps"],
            pred_len=steps,
            sample_count=samples
        )
        result["latency_ms"] = int((time.time() - t0) * 1000)
        set_cached_forecast(cache_key, result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/forecast")
def post_forecast(req: ForecastRequest):
    try:
        t0 = time.time()
        if req.candles and len(req.candles) >= 50:
            rows = []
            for c in req.candles[-400:]:
                rows.append({
                    "timestamps": pd.to_datetime(c.timestamp, unit="ms"),
                    "open": float(c.open),
                    "high": float(c.high),
                    "low": float(c.low),
                    "close": float(c.close),
                    "volume": float(c.volume),
                    "amount": float(c.amount) if c.amount is not None else float(c.volume * c.close),
                })
            df = pd.DataFrame(rows)
            df.attrs["symbol"] = req.symbol
            df.attrs["interval"] = req.interval
        else:
            df = fetch_binance_klines(req.symbol, req.interval, limit=400)

        result = run_kronos_inference(
            df=df,
            timestamps=df["timestamps"],
            pred_len=req.steps,
            sample_count=req.sample_count
        )
        result["latency_ms"] = int((time.time() - t0) * 1000)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8088)
