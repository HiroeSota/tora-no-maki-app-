const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function extractAllQuestions(content) {
  const start = content.indexOf('const ALL_QUESTIONS = [');
  if (start === -1) return null;

  const arrayStart = content.indexOf('[', start);
  let depth = 0;
  let i = arrayStart;

  while (i < content.length) {
    if (content[i] === '[') depth++;
    else if (content[i] === ']') {
      depth--;
      if (depth === 0) {
        return new Function(`return ${content.slice(arrayStart, i + 1)}`)();
      }
    }
    i++;
  }
  return null;
}

try {
  const staged = execSync('git diff --cached --name-only').toString();
  const htmlFiles = staged.split('\n').filter(f => f.trim().endsWith('.html'));

  if (htmlFiles.length === 0) process.exit(0);

  let hasError = false;

  for (const file of htmlFiles) {
    console.log(`\n[チェック] ${file}`);
    const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');

    if (content.includes('解説')) {
      console.error('  ❌ 禁止ワード「解説」が含まれています');
      hasError = true;
    }

    const questions = extractAllQuestions(content);
    if (!questions) {
      console.log('  ℹ ALL_QUESTIONS が見つからないためスキップ');
      continue;
    }

    console.log(`  📋 問題数: ${questions.length}`);
    const required = ['category', 'text', 'choices', 'answer', 'difficulty', 'hint'];

    questions.forEach((q, i) => {
      const label = `Q${i + 1}`;

      for (const field of required) {
        if (q[field] === undefined || q[field] === null) {
          console.error(`  ❌ ${label}: "${field}" フィールドがありません`);
          hasError = true;
        }
      }

      if (!Array.isArray(q.choices) || q.choices.length !== 4) {
        console.error(`  ❌ ${label}: choices が4つではありません（${q.choices?.length ?? 0}つ）`);
        hasError = true;
      }

      if (typeof q.answer !== 'number' || q.answer < 0 || q.answer > 3) {
        console.error(`  ❌ ${label}: answer が 0〜3 の範囲外です（${q.answer}）`);
        hasError = true;
      }

      if (![1, 2, 3].includes(q.difficulty)) {
        console.error(`  ❌ ${label}: difficulty が 1〜3 の範囲外です（${q.difficulty}）`);
        hasError = true;
      }
    });

    // 重複問題チェック
    const texts = questions.map(q => q.text);
    const duplicates = [...new Set(texts.filter((t, i) => texts.indexOf(t) !== i))];
    duplicates.forEach(t => {
      console.error(`  ❌ 重複問題を検出: 「${t.slice(0, 30)}…」`);
      hasError = true;
    });

    if (!hasError) {
      console.log(`  ✅ 全チェック通過（${questions.length}問）`);
    }
  }

  if (hasError) {
    console.error('\n❌ コミットを中止します。上記のエラーを修正してください。');
    process.exit(1);
  }

  process.exit(0);
} catch (error) {
  console.error('❌ スクリプト実行エラー:', error.message);
  process.exit(1);
}
