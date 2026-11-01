/**
 * Weight Measurement & Keg Scale Valuation Service
 *
 * Implements weight-based stock audit and inventory valuation.
 * Example:
 *   A full keg tank weighs 60kgs. kg = KES 150.
 *   A worker finds keg weighing 31kg on the counter scale.
 *   The system calculates the value: 31 * 150 = 4,650 KES.
 */

import { Product, ShiftStockItem } from '../types';

export interface WeightCalculationResult {
  weightKg: number;
  tareWeightKg: number;
  netWeightKg: number;
  pricePerKg: number;
  totalValueKes: number;
  fullWeightKg: number;
  fillPercentage: number;
  formulaDisplay: string;
}

export interface WeightReconciliationResult {
  openingWeightKg: number;
  additionsWeightKg: number;
  totalAvailableWeightKg: number;
  closingWeightKg: number;
  weightSoldKg: number;
  pricePerKg: number;
  revenueKes: number;
  remainingStockValueKes: number;
}

export interface WeightDiscrepancyResult {
  expectedKg: number;
  actualKg: number;
  varianceKg: number;
  monetaryVarianceKes: number;
  isShortage: boolean;
  isSurplus: boolean;
  summaryText: string;
}

export class WeightMeasurementService {
  /**
   * Calculates the monetary valuation of stock measured by weight on a scale.
   * Core formula: Net Weight (kg) × Price per kg (KES) = Total Value (KES)
   * e.g. 31 kg × KES 150/kg = KES 4,650
   */
  public calculateValue(
    weightKg: number,
    pricePerKg: number,
    tareWeightKg: number = 0,
    fullWeightKg: number = 60
  ): WeightCalculationResult {
    const cleanWeight = Math.max(0, Number(weightKg) || 0);
    const cleanPrice = Math.max(0, Number(pricePerKg) || 0);
    const cleanTare = Math.max(0, Number(tareWeightKg) || 0);
    const netWeight = Math.max(0, cleanWeight - cleanTare);
    const totalValue = Math.round(netWeight * cleanPrice * 100) / 100;

    const usableCapacity = Math.max(0.1, (fullWeightKg || 60) - cleanTare);
    const fillPercentage = Math.min(100, Math.round((netWeight / usableCapacity) * 1000) / 10);

    return {
      weightKg: cleanWeight,
      tareWeightKg: cleanTare,
      netWeightKg: netWeight,
      pricePerKg: cleanPrice,
      totalValueKes: totalValue,
      fullWeightKg: fullWeightKg || 60,
      fillPercentage,
      formulaDisplay: `${cleanWeight} kg × KES ${cleanPrice.toLocaleString()} = KES ${totalValue.toLocaleString()}`,
    };
  }

  /**
   * Reconciles shift sales and remaining stock from physical scale weight readings.
   */
  public reconcileShiftItem(
    openingKg: number,
    additionsKg: number,
    closingKg: number,
    pricePerKg: number,
    tareWeightKg: number = 0
  ): WeightReconciliationResult {
    const totalAvailableKg = (Number(openingKg) || 0) + (Number(additionsKg) || 0);
    const actualClosingKg = Number(closingKg) || 0;
    const soldKg = Math.round(Math.max(0, totalAvailableKg - actualClosingKg) * 100) / 100;
    const cleanPrice = Number(pricePerKg) || 0;

    const revenueKes = Math.round(soldKg * cleanPrice * 100) / 100;
    const remainingStockValue = this.calculateValue(actualClosingKg, cleanPrice, tareWeightKg).totalValueKes;

    return {
      openingWeightKg: openingKg,
      additionsWeightKg: additionsKg,
      totalAvailableWeightKg: totalAvailableKg,
      closingWeightKg: actualClosingKg,
      weightSoldKg: soldKg,
      pricePerKg: cleanPrice,
      revenueKes,
      remainingStockValueKes: remainingStockValue,
    };
  }

  /**
   * Checks for handover inconsistencies / shortages during shift opening count
   */
  public evaluateHandoverVariance(
    expectedKg: number,
    actualKg: number,
    pricePerKg: number
  ): WeightDiscrepancyResult {
    const varianceKg = Math.round((actualKg - expectedKg) * 100) / 100;
    const monetaryVarianceKes = Math.round(Math.abs(varianceKg) * pricePerKg * 100) / 100;
    const isShortage = varianceKg < 0;
    const isSurplus = varianceKg > 0;

    let summaryText = 'Physical count matches expected weight perfectly.';
    if (isShortage) {
      summaryText = `Handover Shortage: ${Math.abs(varianceKg)} kg missing (${Math.abs(varianceKg)} kg × KES ${pricePerKg} = KES ${monetaryVarianceKes.toLocaleString()}).`;
    } else if (isSurplus) {
      summaryText = `Handover Surplus: +${varianceKg} kg extra found on scale (+KES ${monetaryVarianceKes.toLocaleString()}).`;
    }

    return {
      expectedKg,
      actualKg,
      varianceKg,
      monetaryVarianceKes,
      isShortage,
      isSurplus,
      summaryText,
    };
  }

  /**
   * Helper to identify if a product or stock item is measured by weight
   */
  public isWeightMeasured(item?: Product | ShiftStockItem | null): boolean {
    if (!item) return false;
    return (
      item.measurementType === 'WEIGHT' ||
      item.unit === 'KG' ||
      (item.isMeasured === true && item.fullWeightKg !== undefined && item.fullWeightKg > 0)
    );
  }

  /**
   * Preset standard keg draft configurations for rapid setup in Kenya & East Africa
   */
  public getStandardKegPresets() {
    return [
      {
        name: 'Tusker Keg Draft (60kg)',
        category: 'BEER' as const,
        fullWeightKg: 60,
        emptyWeightKg: 0,
        pricePerKg: 150,
        description: 'Standard 60kg keg tank @ KES 150 per kg',
      },
      {
        name: 'Senator Keg Draft (60kg)',
        category: 'BEER' as const,
        fullWeightKg: 60,
        emptyWeightKg: 0,
        pricePerKg: 120,
        description: 'Standard 60kg keg tank @ KES 120 per kg',
      },
      {
        name: 'Guinness Draught Keg (30kg)',
        category: 'BEER' as const,
        fullWeightKg: 30,
        emptyWeightKg: 0,
        pricePerKg: 220,
        description: '30kg stainless keg @ KES 220 per kg',
      },
      {
        name: 'Balozi Draft Keg (50kg)',
        category: 'BEER' as const,
        fullWeightKg: 50,
        emptyWeightKg: 0,
        pricePerKg: 140,
        description: '50kg keg tank @ KES 140 per kg',
      },
      {
        name: 'WhiteCap Lager Keg (50kg)',
        category: 'BEER' as const,
        fullWeightKg: 50,
        emptyWeightKg: 0,
        pricePerKg: 160,
        description: '50kg keg tank @ KES 160 per kg',
      },
      {
        name: 'Bulk Wine Cask (25kg)',
        category: 'WINE' as const,
        fullWeightKg: 25,
        emptyWeightKg: 0,
        pricePerKg: 350,
        description: '25kg dispenser @ KES 350 per kg',
      },
    ];
  }
}

export const weightMeasurementService = new WeightMeasurementService();
