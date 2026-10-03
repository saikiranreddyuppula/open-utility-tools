import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-web-server-log-analyzer-v1',
  name: 'Web Server Log Analyzer',
  slug: 'web-server-log-analyzer',
  description:
    'Analyze nginx, Apache, JSON, logfmt and AWS ALB access logs in your browser: traffic over time, top IPs and paths, errors, bots, latency percentiles and suspicious requests, with filters and CSV/JSON export.',
  category: 'data',
  tags: ['logs', 'nginx', 'apache', 'access-log', 'analytics', 'security'],
  keywords: [
    'access log analyzer',
    'nginx log analyzer',
    'apache log analyzer',
    'web server log viewer',
    'parse access.log',
    'top ip addresses log',
    'http status code report',
    'log_format parser',
    'combined log format',
    'aws alb log analyzer',
    'bot traffic analysis',
    'p95 response time from logs',
    'find 404 and 500 errors',
    'log file statistics',
  ],
  icon: 'ServerCog',
  relatedTools: ['har-viewer-sanitizer', 'http-status-codes', 'user-agent-parser', 'regex-tester'],
};

export default meta;
