/** Unit conversion tables (factor-to-base) for common physical quantities. */

export interface Unit {
  id: string;
  name: string;
  /** Multiply a value in this unit by `factor` to get the base unit. */
  factor: number;
  offset?: number; // for temperature
}

export interface UnitCategory {
  id: string;
  name: string;
  base: string;
  units: Unit[];
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: 'length',
    name: 'Length',
    base: 'm',
    units: [
      { id: 'mm', name: 'Millimeter', factor: 0.001 },
      { id: 'cm', name: 'Centimeter', factor: 0.01 },
      { id: 'm', name: 'Meter', factor: 1 },
      { id: 'km', name: 'Kilometer', factor: 1000 },
      { id: 'in', name: 'Inch', factor: 0.0254 },
      { id: 'ft', name: 'Foot', factor: 0.3048 },
      { id: 'yd', name: 'Yard', factor: 0.9144 },
      { id: 'mi', name: 'Mile', factor: 1609.344 },
      { id: 'nmi', name: 'Nautical mile', factor: 1852 },
    ],
  },
  {
    id: 'mass',
    name: 'Mass',
    base: 'kg',
    units: [
      { id: 'mg', name: 'Milligram', factor: 1e-6 },
      { id: 'g', name: 'Gram', factor: 0.001 },
      { id: 'kg', name: 'Kilogram', factor: 1 },
      { id: 't', name: 'Tonne', factor: 1000 },
      { id: 'oz', name: 'Ounce', factor: 0.0283495 },
      { id: 'lb', name: 'Pound', factor: 0.453592 },
      { id: 'st', name: 'Stone', factor: 6.35029 },
    ],
  },
  {
    id: 'temperature',
    name: 'Temperature',
    base: 'K',
    units: [
      { id: 'C', name: 'Celsius', factor: 1, offset: 273.15 },
      { id: 'F', name: 'Fahrenheit', factor: 5 / 9, offset: 459.67 * (5 / 9) },
      { id: 'K', name: 'Kelvin', factor: 1, offset: 0 },
    ],
  },
  {
    id: 'area',
    name: 'Area',
    base: 'm²',
    units: [
      { id: 'cm2', name: 'cm²', factor: 0.0001 },
      { id: 'm2', name: 'm²', factor: 1 },
      { id: 'ha', name: 'Hectare', factor: 10000 },
      { id: 'km2', name: 'km²', factor: 1e6 },
      { id: 'ft2', name: 'ft²', factor: 0.092903 },
      { id: 'ac', name: 'Acre', factor: 4046.86 },
    ],
  },
  {
    id: 'volume',
    name: 'Volume',
    base: 'L',
    units: [
      { id: 'ml', name: 'Milliliter', factor: 0.001 },
      { id: 'l', name: 'Liter', factor: 1 },
      { id: 'm3', name: 'm³', factor: 1000 },
      { id: 'tsp', name: 'Teaspoon (US)', factor: 0.00492892 },
      { id: 'tbsp', name: 'Tablespoon (US)', factor: 0.0147868 },
      { id: 'cup', name: 'Cup (US)', factor: 0.236588 },
      { id: 'pt', name: 'Pint (US)', factor: 0.473176 },
      { id: 'gal', name: 'Gallon (US)', factor: 3.78541 },
    ],
  },
  {
    id: 'speed',
    name: 'Speed',
    base: 'm/s',
    units: [
      { id: 'mps', name: 'm/s', factor: 1 },
      { id: 'kmh', name: 'km/h', factor: 1 / 3.6 },
      { id: 'mph', name: 'mph', factor: 0.44704 },
      { id: 'kn', name: 'Knot', factor: 0.514444 },
    ],
  },
  {
    id: 'data',
    name: 'Data',
    base: 'B',
    units: [
      { id: 'b', name: 'Bit', factor: 0.125 },
      { id: 'B', name: 'Byte', factor: 1 },
      { id: 'KB', name: 'Kilobyte', factor: 1000 },
      { id: 'KiB', name: 'Kibibyte', factor: 1024 },
      { id: 'MB', name: 'Megabyte', factor: 1e6 },
      { id: 'MiB', name: 'Mebibyte', factor: 1024 ** 2 },
      { id: 'GB', name: 'Gigabyte', factor: 1e9 },
      { id: 'GiB', name: 'Gibibyte', factor: 1024 ** 3 },
      { id: 'TB', name: 'Terabyte', factor: 1e12 },
    ],
  },
];

/** Convert between two units in the same category. Temperature uses offsets. */
export function convertUnit(value: number, from: Unit, to: Unit): number {
  // To base, then to target. Temperature: base is Kelvin.
  const base = value * from.factor + (from.offset ?? 0);
  return (base - (to.offset ?? 0)) / to.factor;
}
