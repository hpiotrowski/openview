import { registerIndicator, KLineData } from 'klinecharts';
import { CipherBCalculator, CipherBResult } from './cipherB';
import { CVDCalculator, CVDResult } from './cvd';

let isRegistered = false;

export function registerCustomIndicators() {
  if (isRegistered) return;
  isRegistered = true;

  // 1. Register Market Cipher B / VuManChu Cipher B
  registerIndicator<CipherBResult>({
    name: 'CIPHER_B',
    shortName: 'Cipher B',
    calc: (dataList: KLineData[]) => CipherBCalculator.calculate(dataList),
    figures: [
      {
        key: 'mfi',
        title: 'MFI: ',
        type: 'bar',
        baseValue: 0,
        styles: ({ data }) => {
          const val = data.current?.mfi ?? 0;
          return {
            color: val >= 0 ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)',
          };
        },
      },
      {
        key: 'wt1',
        title: 'WT1: ',
        type: 'line',
        styles: () => ({ color: '#00e5ff', size: 1.5 }),
      },
      {
        key: 'wt2',
        title: 'WT2: ',
        type: 'line',
        styles: () => ({ color: '#ff5252', size: 1.5 }),
      },
      {
        key: 'buyDot',
        title: 'Buy: ',
        type: 'circle',
        styles: () => ({ color: '#00e676', size: 4 }),
      },
      {
        key: 'sellDot',
        title: 'Sell: ',
        type: 'circle',
        styles: () => ({ color: '#ff1744', size: 4 }),
      },
      {
        key: 'goldDot',
        title: 'Gold: ',
        type: 'circle',
        styles: () => ({ color: '#ffd600', size: 6 }),
      },
    ],
  });

  // 2. Register Cumulative Volume Delta (CVD)
  registerIndicator<CVDResult>({
    name: 'CVD',
    shortName: 'CVD',
    calc: (dataList: KLineData[]) => CVDCalculator.calculate(dataList),
    figures: [
      {
        key: 'delta',
        title: 'Delta: ',
        type: 'bar',
        baseValue: 0,
        styles: ({ data }) => {
          const val = data.current?.delta ?? 0;
          return {
            color: val >= 0 ? 'rgba(8, 153, 129, 0.6)' : 'rgba(242, 54, 69, 0.6)',
          };
        },
      },
      {
        key: 'cvd',
        title: 'CVD: ',
        type: 'line',
        styles: () => ({ color: '#ffeb3b', size: 1.5 }),
      },
    ],
  });
}
