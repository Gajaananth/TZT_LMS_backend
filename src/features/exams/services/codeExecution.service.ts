import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TestCase {
  id?: string;
  input?: string;
  expectedOutput?: string;
  isHidden?: boolean;
  type?: 'io' | 'dom_selector' | 'css_property' | 'element_text' | 'element_attribute' | 'contains_code';
  selector?: string;
  property?: string;
  attribute?: string;
  expectedValue?: string;
  expectedText?: string;
  description?: string;
}

export interface TestCaseResult {
  id: string;
  passed: boolean;
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  error?: string;
  executionTimeMs?: number;
  isHidden?: boolean;
  description?: string;
}

export interface CodeExecutionSummary {
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  scoreRatio: number; // 0.0 to 1.0
  results: TestCaseResult[];
}

const NORMALIZE_LANG_MAP: Record<string, { pistonLang: string; pistonVersion: string; ext: string }> = {
  python: { pistonLang: 'python', pistonVersion: '3.10.0', ext: 'py' },
  python3: { pistonLang: 'python', pistonVersion: '3.10.0', ext: 'py' },
  py: { pistonLang: 'python', pistonVersion: '3.10.0', ext: 'py' },
  javascript: { pistonLang: 'javascript', pistonVersion: '18.15.0', ext: 'js' },
  js: { pistonLang: 'javascript', pistonVersion: '18.15.0', ext: 'js' },
  node: { pistonLang: 'javascript', pistonVersion: '18.15.0', ext: 'js' },
  java: { pistonLang: 'java', pistonVersion: '15.0.2', ext: 'java' },
  html: { pistonLang: 'html', pistonVersion: '', ext: 'html' },
  css: { pistonLang: 'css', pistonVersion: '', ext: 'css' },
  html_css: { pistonLang: 'html', pistonVersion: '', ext: 'html' },
  web: { pistonLang: 'html', pistonVersion: '', ext: 'html' },
};

const normalizeOutput = (str: any): string => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
};

export class CodeExecutionService {
  /**
   * Executes a code snippet with stdin input using the Piston Sandbox API
   */
  private static async executeViaPiston(
    code: string,
    language: string,
    stdin: string = '',
    timeoutMs: number = 7000
  ): Promise<{ stdout: string; stderr: string; executionTimeMs: number }> {
    const langConfig = NORMALIZE_LANG_MAP[language.toLowerCase()] || {
      pistonLang: language.toLowerCase(),
      pistonVersion: '*',
      ext: 'txt',
    };

    const fileName = langConfig.pistonLang === 'java' ? 'Solution.java' : `main.${langConfig.ext}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();

    try {
      const response = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: langConfig.pistonLang,
          version: langConfig.pistonVersion,
          files: [{ name: fileName, content: code }],
          stdin: stdin || '',
          run_timeout: Math.floor(timeoutMs / 1000),
        }),
        signal: controller.signal,
      });

      const duration = Date.now() - start;

      if (!response.ok) {
        throw new Error(`Piston API HTTP ${response.status}: ${await response.text()}`);
      }

      const data = (await response.json()) as any;
      const run = data.run || {};
      return {
        stdout: run.stdout || '',
        stderr: run.stderr || (run.code !== 0 && run.signal ? `Terminated with signal ${run.signal}` : ''),
        executionTimeMs: duration,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Local fallback for Python and JavaScript if remote sandbox is offline
   */
  private static async executeLocally(
    code: string,
    language: string,
    stdin: string = '',
    timeoutMs: number = 5000
  ): Promise<{ stdout: string; stderr: string; executionTimeMs: number }> {
    const lang = language.toLowerCase();
    const isPy = lang === 'python' || lang === 'py' || lang === 'python3';
    const isJs = lang === 'javascript' || lang === 'js' || lang === 'node';

    if (!isPy && !isJs) {
      throw new Error(`Local execution fallback only supports Python and JavaScript. For Java, remote sandbox is used.`);
    }

    const start = Date.now();
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `exec_${Date.now()}_${Math.random().toString(36).slice(2)}.${isPy ? 'py' : 'js'}`);

    await fs.promises.writeFile(tempFile, code, 'utf8');

    return new Promise((resolve, reject) => {
      const cmd = isPy ? 'python' : 'node';
      const child = spawn(cmd, [tempFile], {
        timeout: timeoutMs,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => {
        stdout += d.toString();
      });

      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      if (stdin) {
        child.stdin.write(stdin);
      }
      child.stdin.end();

      child.on('close', async (exitCode) => {
        try {
          await fs.promises.unlink(tempFile);
        } catch {
          /* ignore cleanup errors */
        }
        resolve({
          stdout,
          stderr: exitCode !== 0 && !stderr ? `Process exited with code ${exitCode}` : stderr,
          executionTimeMs: Date.now() - start,
        });
      });

      child.on('error', async (err) => {
        try {
          await fs.promises.unlink(tempFile);
        } catch {
          /* ignore cleanup errors */
        }
        reject(err);
      });
    });
  }

  /**
   * Evaluates HTML / CSS tasks by inspecting DOM tags, text, attributes, and CSS rules
   */
  public static evaluateHtmlCssTask(
    code: string,
    testCases: TestCase[]
  ): CodeExecutionSummary {
    const results: TestCaseResult[] = [];
    let passedCount = 0;

    // Separate HTML and CSS (either inline or full page)
    const styleMatches = code.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const cssContent = styleMatches.map((m) => m.replace(/<\/?style[^>]*>/gi, '')).join('\n') + '\n' + code;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const tcId = tc.id || `tc-${i + 1}`;
      let passed = false;
      let actualOutput = '';
      let error = '';

      try {
        const type = tc.type || 'dom_selector';

        switch (type) {
          case 'dom_selector': {
            // Check if element or tag exists: e.g. "h1", "#title", ".card", "input[type='text']"
            const sel = (tc.selector || tc.input || '').trim();
            if (!sel) {
              passed = true;
              break;
            }
            if (sel.startsWith('#')) {
              const idVal = sel.slice(1);
              const regex = new RegExp(`id=["']${idVal}["']`, 'i');
              passed = regex.test(code);
              actualOutput = passed ? `Element with id="${idVal}" found` : `Element with id="${idVal}" not found`;
            } else if (sel.startsWith('.')) {
              const classVal = sel.slice(1);
              const regex = new RegExp(`class=["'][^"']*\\b${classVal}\\b[^"']*["']`, 'i');
              passed = regex.test(code);
              actualOutput = passed ? `Element with class="${classVal}" found` : `Element with class="${classVal}" not found`;
            } else {
              // Tag search e.g. <h1 or <button
              const tag = sel.replace(/[^a-zA-Z0-9_-]/g, '');
              const regex = new RegExp(`<${tag}\\b`, 'i');
              passed = regex.test(code);
              actualOutput = passed ? `<${tag}> tag exists` : `<${tag}> tag missing`;
            }
            break;
          }

          case 'element_text': {
            const expected = (tc.expectedText || tc.expectedOutput || '').trim();
            const sel = (tc.selector || tc.input || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
            let regex: RegExp;
            if (sel) {
              regex = new RegExp(`<${sel}[^>]*>([\\s\\S]*?)<\\/${sel}>`, 'i');
            } else {
              regex = new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            }
            const match = code.match(regex);
            if (match) {
              const textContent = match[1] ? match[1].replace(/<[^>]*>/g, '').trim() : match[0].trim();
              passed = normalizeOutput(textContent).toLowerCase().includes(expected.toLowerCase());
              actualOutput = textContent;
            } else {
              passed = code.toLowerCase().includes(expected.toLowerCase());
              actualOutput = passed ? `Found text "${expected}"` : `Text "${expected}" not found`;
            }
            break;
          }

          case 'css_property': {
            // Check CSS selector and property: e.g. selector: "h1", property: "color", expectedValue: "blue"
            const sel = (tc.selector || '').trim();
            const prop = (tc.property || tc.input || '').trim().toLowerCase();
            const val = (tc.expectedValue || tc.expectedOutput || '').trim().toLowerCase();

            // Match selector block in CSS: sel { ... }
            const blockRegex = new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^\\}]+)\\}`, 'i');
            const match = cssContent.match(blockRegex);
            if (match) {
              const body = match[1];
              const propRegex = new RegExp(`${prop}\\s*:\\s*([^;\\}]+)`, 'i');
              const propMatch = body.match(propRegex);
              if (propMatch) {
                const foundVal = propMatch[1].trim().toLowerCase();
                passed = !val || foundVal.includes(val);
                actualOutput = `${prop}: ${foundVal}`;
              } else {
                actualOutput = `Property "${prop}" not found inside "${sel}" rule`;
              }
            } else {
              // Also check inline style: style="...color: red..."
              const inlineRegex = new RegExp(`${prop}\\s*:\\s*([^;"]+)`, 'i');
              const inlineMatch = code.match(inlineRegex);
              if (inlineMatch) {
                const foundVal = inlineMatch[1].trim().toLowerCase();
                passed = !val || foundVal.includes(val);
                actualOutput = `Inline: ${prop}: ${foundVal}`;
              } else {
                actualOutput = `CSS rule for "${sel}" not found`;
              }
            }
            break;
          }

          case 'contains_code':
          default: {
            const expected = (tc.expectedOutput || tc.input || '').trim();
            passed = code.includes(expected);
            actualOutput = passed ? `Matched code snippet` : `Snippet not found`;
            break;
          }
        }
      } catch (err: any) {
        error = err.message || 'Validation error';
      }

      if (passed) passedCount++;

      results.push({
        id: tcId,
        passed,
        input: tc.input || tc.selector || '',
        expectedOutput: tc.expectedOutput || tc.expectedText || tc.expectedValue || 'Condition met',
        actualOutput,
        error: error || undefined,
        isHidden: !!tc.isHidden,
        description: tc.description || `Test case ${i + 1}`,
      });
    }

    const totalCount = testCases.length || 1;
    return {
      allPassed: passedCount === totalCount,
      passedCount,
      totalCount,
      scoreRatio: totalCount > 0 ? passedCount / totalCount : 0,
      results,
    };
  }

  /**
   * Main entry point to run code against multiple test cases
   */
  public static async runTestCases(
    code: string,
    language: string,
    testCases: TestCase[],
    options: { onlyPublic?: boolean } = {}
  ): Promise<CodeExecutionSummary> {
    const lang = (language || 'python').toLowerCase();
    const casesToRun = options.onlyPublic ? testCases.filter((tc) => !tc.isHidden) : testCases;

    if (!casesToRun || casesToRun.length === 0) {
      return {
        allPassed: true,
        passedCount: 0,
        totalCount: 0,
        scoreRatio: 1.0,
        results: [],
      };
    }

    // If HTML / CSS / Web, evaluate DOM / style rules directly
    if (['html', 'css', 'html_css', 'web'].includes(lang)) {
      return this.evaluateHtmlCssTask(code, casesToRun);
    }

    const results: TestCaseResult[] = [];
    let passedCount = 0;

    for (let i = 0; i < casesToRun.length; i++) {
      const tc = casesToRun[i];
      const tcId = tc.id || `tc-${i + 1}`;
      const input = tc.input || '';
      const expected = normalizeOutput(tc.expectedOutput || '');

      let executionRes: { stdout: string; stderr: string; executionTimeMs: number };

      try {
        // Try Piston sandbox first
        try {
          executionRes = await this.executeViaPiston(code, lang, input, 8000);
        } catch (pistonErr) {
          // If remote fails, fallback locally for Python or JS
          executionRes = await this.executeLocally(code, lang, input, 6000);
        }

        const actualNormalized = normalizeOutput(executionRes.stdout);
        const hasStderr = Boolean(executionRes.stderr && executionRes.stderr.trim().length > 0);
        const passed = !hasStderr && actualNormalized === expected;

        if (passed) {
          passedCount++;
        }

        results.push({
          id: tcId,
          passed,
          input: tc.isHidden ? '[Hidden]' : input,
          expectedOutput: tc.isHidden ? '[Hidden]' : expected,
          actualOutput: tc.isHidden ? (passed ? '[Correct Output]' : '[Wrong Output]') : actualNormalized,
          error: executionRes.stderr ? executionRes.stderr.slice(0, 1000) : undefined,
          executionTimeMs: executionRes.executionTimeMs,
          isHidden: !!tc.isHidden,
          description: tc.description || `Test case ${i + 1}`,
        });
      } catch (err: any) {
        results.push({
          id: tcId,
          passed: false,
          input: tc.isHidden ? '[Hidden]' : input,
          expectedOutput: tc.isHidden ? '[Hidden]' : expected,
          actualOutput: '',
          error: err.message || 'Execution error',
          isHidden: !!tc.isHidden,
          description: tc.description || `Test case ${i + 1}`,
        });
      }
    }

    const totalCount = casesToRun.length;
    return {
      allPassed: passedCount === totalCount,
      passedCount,
      totalCount,
      scoreRatio: totalCount > 0 ? passedCount / totalCount : 0,
      results,
    };
  }
}

export default CodeExecutionService;
