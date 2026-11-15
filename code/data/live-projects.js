// 「本物のAIで体験」用の仮想プロジェクト（ブラウザ内の Python で実行される）
export const LIVE_PROJECTS = [
  {
    id: 'budget', title: '家計簿アプリ（バグあり）',
    desc: 'テストが1つ落ちています。バグ修正 → 機能追加 → CLAUDE.md 作成まで一通り体験できます。',
    tasks: ['テストが落ちているので原因を調べて直して', 'カテゴリ別の合計を金額の多い順に表示する機能を追加して。テストも書いて', '/init', 'このプロジェクトの構成を説明して', 'budget.py をもっと読みやすくリファクタリングして。挙動は変えないで'],
    files: {
      'README.md': '# 家計簿アプリ\n\n支出を記録して集計するシンプルな家計簿。\n\n- `python main.py` で実行\n- テスト: tests/ 以下\n',
      'budget.py': `"""家計簿のロジック"""


class Budget:
    def __init__(self):
        self.items = []

    def add(self, name, amount, category="その他"):
        if amount <= 0:
            raise ValueError("金額は正の数で入力してください")
        self.items.append({"name": name, "amount": amount, "category": category})

    def total(self):
        return sum(item["amount"] for item in self.items)

    def total_by_category(self, category):
        total = 0
        for item in self.items:
            if item["category"] == category:
                total = item["amount"]
        return total

    def largest(self):
        if not self.items:
            return None
        return max(self.items, key=lambda i: i["amount"])
`,
      'main.py': `from budget import Budget

b = Budget()
b.add("ランチ", 900, "食費")
b.add("電車", 420, "交通")
b.add("夕食の買い物", 2300, "食費")
b.add("本", 1650, "趣味")

print(f"合計: {b.total()}円")
print(f"食費: {b.total_by_category('食費')}円")
big = b.largest()
print(f"最大の支出: {big['name']} {big['amount']}円")
`,
      'tests/test_budget.py': `from budget import Budget


def make():
    b = Budget()
    b.add("ランチ", 900, "食費")
    b.add("電車", 420, "交通")
    b.add("夕食", 2300, "食費")
    return b


def test_total():
    assert make().total() == 3620


def test_total_by_category():
    assert make().total_by_category("食費") == 3200


def test_largest():
    assert make().largest()["name"] == "夕食"


def test_negative_amount():
    b = Budget()
    try:
        b.add("返金", -100)
        assert False, "ValueError が出るはず"
    except ValueError:
        pass
`,
    },
  },
  {
    id: 'quiz', title: '単語クイズ（機能追加）',
    desc: '動くけれど機能が少ないクイズ。テストのない状態から、テストを書かせて機能を足す流れを体験。',
    tasks: ['まずテストを書いて。quiz.py の関数を対象に', '間違えた問題だけをもう一度出題する復習モードを追加して', '正答率を % で表示するようにして', 'main.py を stdin「apple\\nねこ\\n犬」で実行して動作確認して'],
    files: {
      'quiz.py': `WORDS = {
    "りんご": "apple",
    "ねこ": "cat",
    "いぬ": "dog",
    "本": "book",
    "水": "water",
}


def check(question, answer):
    return WORDS[question] == answer.strip().lower()


def run(questions, answers):
    score = 0
    for q, a in zip(questions, answers):
        if check(q, a):
            score += 1
    return score
`,
      'main.py': `from quiz import WORDS, check

score = 0
for q in list(WORDS)[:3]:
    a = input(f"「{q}」は英語で？ ")
    if check(q, a):
        print("正解！")
        score += 1
    else:
        print(f"残念… 正解は {WORDS[q]}")
print(f"{score} / 3 問正解")
`,
    },
  },
  {
    id: 'empty', title: '空のプロジェクト（ゼロから作る）',
    desc: '何もないところから、AI と一緒にアプリを設計・実装します。プランモードで計画から始めるのがおすすめ。',
    tasks: ['じゃんけんゲームを作って。3回勝負で、最後に結果を表示。テストも書いて', 'ToDo リストを管理する CLI を作って（追加・完了・一覧）。データは JSON に保存', 'BMI 計算ツールを作って。関数とテストに分けて'],
    files: {
      'README.md': '# My Project\n\n（ここに何を作るか書いていこう）\n',
    },
  },
];
