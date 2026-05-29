/**
 * Safe math expression evaluator — a small shunting-yard parser + RPN evaluator.
 * Supports + - * / % ^, parentheses, unary minus, functions (sin, cos, tan, sqrt,
 * abs, ln, log, exp, floor, ceil, round, min, max, pow) and constants (pi, e).
 * No eval/Function — input can't execute arbitrary code. Function arity is tracked
 * during parsing so variadic calls like min(1,2,3) work.
 */

interface NumToken { type: 'num'; value: number }
interface OpToken { type: 'op'; value: string }
interface FuncToken { type: 'func'; value: string; argc: number }
interface PunctToken { type: 'paren' | 'comma'; value: string }
type Token = NumToken | OpToken | FuncToken | PunctToken;

const FUNCS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, ln: Math.log, log: Math.log10, log2: Math.log2,
  exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
  min: Math.min, max: Math.max, pow: Math.pow,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };
const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3, 'u-': 4 };
const RIGHT = new Set(['^', 'u-']);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const s = input.replace(/\s+/g, '');
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < s.length && /[0-9.eE]/.test(s[i]!)) {
        if ((s[i] === 'e' || s[i] === 'E') && (s[i + 1] === '+' || s[i + 1] === '-')) {
          num += s[i]! + s[i + 1]!;
          i += 2;
          continue;
        }
        num += s[i++]!;
      }
      tokens.push({ type: 'num', value: parseFloat(num) });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let name = '';
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i]!)) name += s[i++]!;
      const lower = name.toLowerCase();
      if (lower in CONSTS) tokens.push({ type: 'num', value: CONSTS[lower]! });
      else if (lower in FUNCS) tokens.push({ type: 'func', value: lower, argc: 1 });
      else throw new Error(`Unknown name: ${name}`);
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ',' });
      i++;
      continue;
    }
    if ('+-*/%^'.includes(ch)) {
      const prev = tokens[tokens.length - 1];
      const unary =
        ch === '-' &&
        (!prev || prev.type === 'op' || (prev.type === 'paren' && prev.value === '(') || prev.type === 'comma');
      tokens.push({ type: 'op', value: unary ? 'u-' : ch });
      i++;
      continue;
    }
    throw new Error(`Unexpected character: ${ch}`);
  }
  return tokens;
}

export function evaluateExpression(input: string): number {
  if (!input.trim()) throw new Error('Empty expression');
  const tokens = tokenize(input);
  const output: Token[] = [];
  const stack: Token[] = [];
  // argCount[i] tracks the running argument tally for the function at the matching
  // position on the operator stack.
  const argCount: number[] = [];

  for (let idx = 0; idx < tokens.length; idx++) {
    const t = tokens[idx]!;
    const prev = tokens[idx - 1];
    if (t.type === 'num') {
      output.push(t);
    } else if (t.type === 'func') {
      stack.push(t);
    } else if (t.type === 'comma') {
      while (stack.length && stack[stack.length - 1]!.type !== 'paren') output.push(stack.pop()!);
      if (argCount.length) argCount[argCount.length - 1]!++;
    } else if (t.type === 'op') {
      while (
        stack.length &&
        stack[stack.length - 1]!.type === 'op' &&
        (RIGHT.has(t.value)
          ? PREC[stack[stack.length - 1]!.value]! > PREC[t.value]!
          : PREC[stack[stack.length - 1]!.value]! >= PREC[t.value]!)
      ) {
        output.push(stack.pop()!);
      }
      stack.push(t);
    } else if (t.value === '(') {
      stack.push(t);
      // If the token before '(' is a function, start counting its args.
      if (stack.length >= 2 && stack[stack.length - 2]!.type === 'func') {
        // An empty-arg call f() would have prev==='(' and next===')'; handled below.
        argCount.push(prev && prev.type === 'paren' ? 0 : 1);
      }
    } else {
      // ')'
      while (stack.length && stack[stack.length - 1]!.value !== '(') output.push(stack.pop()!);
      if (!stack.length) throw new Error('Mismatched parentheses');
      stack.pop(); // remove '('
      if (stack.length && stack[stack.length - 1]!.type === 'func') {
        const fn = stack.pop() as FuncToken;
        // Empty-call edge: ')' directly after '(' means 0 args.
        const argc = prev && prev.type === 'paren' && prev.value === '(' ? 0 : argCount.pop() ?? 1;
        output.push({ type: 'func', value: fn.value, argc });
      }
    }
  }
  while (stack.length) {
    const op = stack.pop()!;
    if (op.type === 'paren') throw new Error('Mismatched parentheses');
    output.push(op);
  }

  const vs: number[] = [];
  for (const t of output) {
    if (t.type === 'num') {
      vs.push(t.value);
    } else if (t.type === 'op') {
      if (t.value === 'u-') {
        const a = vs.pop();
        if (a === undefined) throw new Error('Invalid expression');
        vs.push(-a);
      } else {
        const b = vs.pop();
        const a = vs.pop();
        if (a === undefined || b === undefined) throw new Error('Invalid expression');
        vs.push(applyOp(t.value, a, b));
      }
    } else if (t.type === 'func') {
      const fn = FUNCS[t.value]!;
      const argc = t.argc;
      if (vs.length < argc) throw new Error('Invalid expression');
      const args = vs.splice(vs.length - argc, argc);
      vs.push(fn(...args));
    }
  }
  if (vs.length !== 1) throw new Error('Invalid expression');
  return vs[0]!;
}

function applyOp(op: string, a: number, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return a / b;
    case '%': return a % b;
    case '^': return a ** b;
    default: throw new Error(`Unknown operator ${op}`);
  }
}
