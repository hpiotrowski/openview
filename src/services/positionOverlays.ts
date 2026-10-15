/**
 * Custom Position Overlays for Klinecharts:
 * 1. Long Position (longPosition) - Green Take Profit box, Red Stop Loss box, dynamic R:R badge.
 * 2. Short Position (shortPosition) - Green Take Profit box down, Red Stop Loss box up, dynamic R:R badge.
 * 3. Rectangle (rect) - standard box drawing tool.
 */

import { registerOverlay, OverlayTemplate, Coordinate } from 'klinecharts';

let registered = false;

export function registerPositionOverlays(): void {
  if (registered) return;
  registered = true;

  // --- 1. LONG POSITION ---
  const longPosition: OverlayTemplate = {
    name: 'longPosition',
    totalStep: 4, // 3 points: 0: Entry, 1: Target, 2: Stop Loss
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates }) => {
      if (!coordinates || coordinates.length < 2) return [];

      const pEntry = overlay.points[0]?.value ?? 0;
      const pTp = overlay.points[1]?.value ?? 0;
      const coordEntry = coordinates[0];
      const coordTp = coordinates[1];

      // If point 2 not yet placed (preview mode during drawing step 3)
      let coordSl: Coordinate;
      let pSl: number;

      if (coordinates.length >= 3 && coordinates[2]) {
        coordSl = coordinates[2];
        pSl = overlay.points[2]?.value ?? pEntry;
      } else {
        // Default 1:2 R:R preview
        const defaultHeight = Math.abs(coordEntry.y - coordTp.y) * 0.5;
        coordSl = { x: coordTp.x, y: coordEntry.y + Math.max(20, defaultHeight) };
        pSl = pEntry - Math.abs(pTp - pEntry) * 0.5;
      }

      const startX = Math.min(coordEntry.x, coordTp.x, coordSl.x);
      let endX = Math.max(coordEntry.x, coordTp.x, coordSl.x);
      if (endX - startX < 80) endX = startX + 140;

      const yEntry = coordEntry.y;
      const yTp = coordTp.y;
      const ySl = coordSl.y;

      // Stats calculations
      const targetDiff = Math.abs(pTp - pEntry);
      const stopDiff = Math.abs(pEntry - pSl);
      const targetPct = pEntry > 0 ? (targetDiff / pEntry) * 100 : 0;
      const stopPct = pEntry > 0 ? (stopDiff / pEntry) * 100 : 0;
      const rr = stopDiff > 0 ? targetDiff / stopDiff : 0;

      const figures: any[] = [];

      // 1. Target Box (Green)
      const topTp = Math.min(yEntry, yTp);
      const botTp = Math.max(yEntry, yTp);
      figures.push({
        type: 'polygon',
        attrs: {
          coordinates: [
            { x: startX, y: topTp },
            { x: endX, y: topTp },
            { x: endX, y: botTp },
            { x: startX, y: botTp },
          ],
        },
        styles: {
          style: 'stroke_fill',
          color: 'rgba(8, 153, 129, 0.22)',
          borderColor: '#089981',
          borderSize: 1,
        },
      });

      // 2. Stop Loss Box (Red)
      const topSl = Math.min(yEntry, ySl);
      const botSl = Math.max(yEntry, ySl);
      figures.push({
        type: 'polygon',
        attrs: {
          coordinates: [
            { x: startX, y: topSl },
            { x: endX, y: topSl },
            { x: endX, y: botSl },
            { x: startX, y: botSl },
          ],
        },
        styles: {
          style: 'stroke_fill',
          color: 'rgba(242, 54, 69, 0.22)',
          borderColor: '#f23645',
          borderSize: 1,
        },
      });

      // 3. Entry Center Line
      figures.push({
        type: 'line',
        attrs: {
          coordinates: [
            { x: startX, y: yEntry },
            { x: endX, y: yEntry },
          ],
        },
        styles: {
          color: '#d1d4dc',
          size: 1.5,
          style: 'solid',
        },
      });

      // 4. Target Label
      figures.push({
        type: 'text',
        attrs: {
          x: startX + 8,
          y: topTp + 6,
          text: `TP: $${pTp.toFixed(2)} (+${targetPct.toFixed(2)}%)`,
        },
        styles: {
          color: '#ffffff',
          backgroundColor: '#089981',
          size: 11,
          weight: 'bold',
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 3,
          paddingBottom: 3,
          borderRadius: 3,
        },
      });

      // 5. R:R Ratio Badge (Middle)
      figures.push({
        type: 'text',
        attrs: {
          x: startX + 8,
          y: yEntry - 10,
          text: `Long | R:R: ${rr.toFixed(2)}`,
        },
        styles: {
          color: '#ffffff',
          backgroundColor: '#1e222d',
          borderColor: '#363c4e',
          borderSize: 1,
          size: 11,
          weight: 'bold',
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 3,
          paddingBottom: 3,
          borderRadius: 3,
        },
      });

      // 6. Stop Loss Label
      figures.push({
        type: 'text',
        attrs: {
          x: startX + 8,
          y: botSl - 22,
          text: `SL: $${pSl.toFixed(2)} (-${stopPct.toFixed(2)}%)`,
        },
        styles: {
          color: '#ffffff',
          backgroundColor: '#f23645',
          size: 11,
          weight: 'bold',
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 3,
          paddingBottom: 3,
          borderRadius: 3,
        },
      });

      return figures;
    },
  };

  // --- 2. SHORT POSITION ---
  const shortPosition: OverlayTemplate = {
    name: 'shortPosition',
    totalStep: 4, // 3 points: 0: Entry, 1: Target (down), 2: Stop Loss (up)
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates }) => {
      if (!coordinates || coordinates.length < 2) return [];

      const pEntry = overlay.points[0]?.value ?? 0;
      const pTp = overlay.points[1]?.value ?? 0;
      const coordEntry = coordinates[0];
      const coordTp = coordinates[1];

      let coordSl: Coordinate;
      let pSl: number;

      if (coordinates.length >= 3 && coordinates[2]) {
        coordSl = coordinates[2];
        pSl = overlay.points[2]?.value ?? pEntry;
      } else {
        const defaultHeight = Math.abs(coordEntry.y - coordTp.y) * 0.5;
        coordSl = { x: coordTp.x, y: coordEntry.y - Math.max(20, defaultHeight) };
        pSl = pEntry + Math.abs(pTp - pEntry) * 0.5;
      }

      const startX = Math.min(coordEntry.x, coordTp.x, coordSl.x);
      let endX = Math.max(coordEntry.x, coordTp.x, coordSl.x);
      if (endX - startX < 80) endX = startX + 140;

      const yEntry = coordEntry.y;
      const yTp = coordTp.y;
      const ySl = coordSl.y;

      const targetDiff = Math.abs(pEntry - pTp);
      const stopDiff = Math.abs(pSl - pEntry);
      const targetPct = pEntry > 0 ? (targetDiff / pEntry) * 100 : 0;
      const stopPct = pEntry > 0 ? (stopDiff / pEntry) * 100 : 0;
      const rr = stopDiff > 0 ? targetDiff / stopDiff : 0;

      const figures: any[] = [];

      // 1. Target Box (Green - downward for short)
      const topTp = Math.min(yEntry, yTp);
      const botTp = Math.max(yEntry, yTp);
      figures.push({
        type: 'polygon',
        attrs: {
          coordinates: [
            { x: startX, y: topTp },
            { x: endX, y: topTp },
            { x: endX, y: botTp },
            { x: startX, y: botTp },
          ],
        },
        styles: {
          style: 'stroke_fill',
          color: 'rgba(8, 153, 129, 0.22)',
          borderColor: '#089981',
          borderSize: 1,
        },
      });

      // 2. Stop Loss Box (Red - upward for short)
      const topSl = Math.min(yEntry, ySl);
      const botSl = Math.max(yEntry, ySl);
      figures.push({
        type: 'polygon',
        attrs: {
          coordinates: [
            { x: startX, y: topSl },
            { x: endX, y: topSl },
            { x: endX, y: botSl },
            { x: startX, y: botSl },
          ],
        },
        styles: {
          style: 'stroke_fill',
          color: 'rgba(242, 54, 69, 0.22)',
          borderColor: '#f23645',
          borderSize: 1,
        },
      });

      // 3. Entry Center Line
      figures.push({
        type: 'line',
        attrs: {
          coordinates: [
            { x: startX, y: yEntry },
            { x: endX, y: yEntry },
          ],
        },
        styles: {
          color: '#d1d4dc',
          size: 1.5,
          style: 'solid',
        },
      });

      // 4. Target Label (bottom of green box)
      figures.push({
        type: 'text',
        attrs: {
          x: startX + 8,
          y: botTp - 22,
          text: `TP: $${pTp.toFixed(2)} (+${targetPct.toFixed(2)}%)`,
        },
        styles: {
          color: '#ffffff',
          backgroundColor: '#089981',
          size: 11,
          weight: 'bold',
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 3,
          paddingBottom: 3,
          borderRadius: 3,
        },
      });

      // 5. R:R Ratio Badge (Middle)
      figures.push({
        type: 'text',
        attrs: {
          x: startX + 8,
          y: yEntry - 10,
          text: `Short | R:R: ${rr.toFixed(2)}`,
        },
        styles: {
          color: '#ffffff',
          backgroundColor: '#1e222d',
          borderColor: '#363c4e',
          borderSize: 1,
          size: 11,
          weight: 'bold',
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 3,
          paddingBottom: 3,
          borderRadius: 3,
        },
      });

      // 6. Stop Loss Label (top of red box)
      figures.push({
        type: 'text',
        attrs: {
          x: startX + 8,
          y: topSl + 6,
          text: `SL: $${pSl.toFixed(2)} (-${stopPct.toFixed(2)}%)`,
        },
        styles: {
          color: '#ffffff',
          backgroundColor: '#f23645',
          size: 11,
          weight: 'bold',
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 3,
          paddingBottom: 3,
          borderRadius: 3,
        },
      });

      return figures;
    },
  };

  // --- 3. RECTANGLE TOOL ---
  const rect: OverlayTemplate = {
    name: 'rect',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ coordinates }) => {
      if (!coordinates || coordinates.length < 2) return [];
      const minX = Math.min(coordinates[0].x, coordinates[1].x);
      const maxX = Math.max(coordinates[0].x, coordinates[1].x);
      const minY = Math.min(coordinates[0].y, coordinates[1].y);
      const maxY = Math.max(coordinates[0].y, coordinates[1].y);
      return [
        {
          type: 'polygon',
          attrs: {
            coordinates: [
              { x: minX, y: minY },
              { x: maxX, y: minY },
              { x: maxX, y: maxY },
              { x: minX, y: maxY },
            ],
          },
          styles: {
            style: 'stroke_fill',
            color: 'rgba(41, 98, 255, 0.15)',
            borderColor: '#2962ff',
            borderSize: 1.5,
          },
        },
      ];
    },
  };

  try {
    registerOverlay(longPosition);
    registerOverlay(shortPosition);
    registerOverlay(rect);
  } catch (err) {
    console.warn('registerPositionOverlays error:', err);
  }
}
