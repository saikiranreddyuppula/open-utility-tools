import type { ToolMetaStatic } from '@/lib/registry';

const PACKAGE_NAME = '@open-utility-tools/core';

const CATEGORY_EXPORTS = new Set([
  'color',
  'crypto',
  'data',
  'generators',
  'math',
  'text',
  'time',
  'web',
]);

const TIME_PRIMARY_EXPORTS: Record<string, string> = {
  'add-business-days': 'addBusinessDays',
  'age-calculator': 'calculateAge',
  'age-on-other-planets': 'agesFromEarthYears',
  'birthday-milestone-finder': 'findBirthdayMilestones',
  'business-days-calculator': 'countBusinessDays',
  'chinese-zodiac-sign': 'chineseZodiacSign',
  'countdown-timer-builder': 'buildCountdownSnapshot',
  'cron-builder': 'buildCronExpression',
  'cron-field-expander': 'expandCron',
  'cron-next-runs-preview': 'cronNextRuns',
  'cron-parser': 'parseCron',
  'date-add-subtract': 'dateAddSubtract',
  'date-difference': 'dateDifference',
  'date-format-converter': 'parseDateInput',
  'date-format-playground': 'formatDatePlayground',
  'date-format-token-reference': 'searchDateFormatTokens',
  'date-range-splitter': 'splitDateRange',
  'day-of-year': 'dateToDayOfYear',
  'day-percentage-elapsed': 'dayPercentageElapsed',
  'days-between-units': 'daysBetweenUnits',
  'days-until': 'daysUntil',
  'decimal-time-converter': 'standardToDecimal',
  'duration-humanizer': 'humanizeDuration',
  'duration-parser': 'parseDuration',
  'epoch-precision-converter': 'convertEpochPrecision',
  'fixed-offset-timezone-math': 'convertFixedOffset',
  'iso-8601-parser': 'parseIso8601',
  'iso-duration-parser': 'parseIsoDuration',
  'iso-week-date-converter': 'dateToIsoWeekDate',
  'julian-day-number': 'gregorianToJulian',
  'leap-year-checker': 'checkLeapYear',
  'moon-phase-calculator': 'calculateMoonPhase',
  'next-weekday-occurrence': 'nextWeekdayOccurrence',
  'nth-weekday-of-month': 'nthWeekdayOfMonth',
  'ordinal-date-converter': 'dateToOrdinal',
  'quarter-of-date': 'quarterOfDate',
  'recurring-event-dates': 'generateRecurringDates',
  'relative-time-formatter': 'formatRelativeTime',
  'stardate-converter': 'dateToStardate',
  'strftime-playground': 'formatStrftime',
  'swatch-internet-time': 'timeToBeats',
  'time-12-24-converter': 'convertTime',
  'time-between-clocks': 'timeBetweenClocks',
  'time-meeting-cost-calculator': 'calculateMeetingCost',
  'time-of-day-bucketer': 'classifyTimeOfDay',
  'time-server-format-reference': 'formatReferenceRows',
  'time-time-duration-arithmetic': 'computeDurationArithmetic',
  'time-timecode-frames-converter': 'timecodeToFrames',
  'time-unit-converter': 'convertTimeUnit',
  'time-zone-meeting-planner': 'planMeeting',
  'timestamp-batch-converter': 'convertTimestampBatch',
  'timestamp-converter': 'convertTimestamp',
  'timezone-converter': 'convertTimezone',
  'unix-nanoseconds-converter': 'nanosecondsToDateTime',
  'unix-rollover-checker': 'buildRolloverMilestones',
  'unix-time-now': 'formatUnixInstant',
  'week-number': 'weekNumber',
  'week-of-month-finder': 'findWeekOfMonth',
  'week-to-date': 'weekToDateRange',
  'weekday-of-date': 'weekdayOfDate',
  'weeks-until-date': 'weeksUntilDate',
  'western-zodiac-sign': 'getWesternZodiacSign',
  'working-hours-calculator': 'calculateWorkingHours',
};

export interface ToolUsageInfo {
  status: 'exact' | 'category' | 'planned';
  installCommand: string;
  importPath?: string;
  importName?: string;
  snippet: string;
  note: string;
}

export function getToolUsageInfo(tool: ToolMetaStatic): ToolUsageInfo {
  const installCommand = `npm install ${PACKAGE_NAME}`;
  const exact = exactUsage(tool);
  if (exact) {
    return {
      status: 'exact',
      installCommand,
      ...exact,
      note: 'This tool has a typed npm API. Import the function directly or inspect the module in your editor for the full export list.',
    };
  }

  if (CATEGORY_EXPORTS.has(tool.category)) {
    const importPath = `${PACKAGE_NAME}/${tool.category}`;
    const namespace = `${toIdentifier(tool.category)}Tools`;
    return {
      status: 'category',
      installCommand,
      importPath,
      snippet: `import * as ${namespace} from '${importPath}';\n\n// ${tool.name} is not exposed as its own per-tool API yet.\n// Use this category module for the helpers already extracted from ${tool.category} tools.\nconsole.log(Object.keys(${namespace}));`,
      note: 'This category is available in the package, but this exact UI tool has not been extracted as a per-tool npm API yet.',
    };
  }

  return {
    status: 'planned',
    installCommand,
    snippet: `// ${tool.name} is currently available in the browser app.\n// A package API for this tool has not been published yet.\n// Track package coverage in the developer docs.`,
    note: 'This tool is browser-only today. Package extraction is planned category by category.',
  };
}

function exactUsage(tool: ToolMetaStatic): Omit<ToolUsageInfo, 'installCommand' | 'status' | 'note'> | null {
  if (tool.category === 'time') {
    const importName = TIME_PRIMARY_EXPORTS[tool.slug];
    if (!importName) return null;
    const importPath = `${PACKAGE_NAME}/time/${tool.slug}`;
    return {
      importPath,
      importName,
      snippet: `import { ${importName} } from '${importPath}';\n\nconst result = ${importName}(/* typed inputs */);\nconsole.log(result);`,
    };
  }

  if (tool.slug === 'image-converter') {
    const importPath = `${PACKAGE_NAME}/image/convert`;
    return {
      importPath,
      importName: 'convert',
      snippet: `import { convert } from '${importPath}';\n\nconst output = await convert(sourceBytes, {\n  format: 'webp',\n  quality: 82,\n  maxWidth: 1200,\n});\nconsole.log(output);`,
    };
  }

  return null;
}

function toIdentifier(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+(.)/g, (_match, char: string) => char.toUpperCase())
    .replace(/^[^a-zA-Z_$]+/, '');
}
