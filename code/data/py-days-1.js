// Python 100日 カリキュラム（オリジナル教材）Day 1〜15
// lesson は簡易マークダウン（### 見出し / - 箇条書き / ```コード``` / > ヒント）
// tests の check は Python コード。__out__ に出力全体、__lines__ に行のリストが入る。
export const DAYS_1 = [
{
  day: 1, title: 'print・input・変数', review: true,
  goal: '画面に表示し、キーボードから受け取り、変数に入れる',
  lesson: `### print() で表示する
\`\`\`python
print("こんにちは")
print("1行目\\n2行目")   # \\n は改行
print("A" + "B")         # 文字列の連結 → AB
\`\`\`
### input() で受け取る
\`input()\` はユーザーが入力した文字を**文字列**として返します。カッコ内の文字はプロンプト（案内）として表示されます。
\`\`\`python
name = input("名前は？ ")
print("ようこそ、" + name + "さん")
\`\`\`
### 変数
\`=\` は「右の値を左の名前に入れる」という意味（等しいではない）。
\`\`\`python
a = "りんご"
b = "みかん"
a, b = b, a     # 入れ替え
print(len(a))   # 文字数 → 3
\`\`\`
> 変数名は英数字と _ で、意味の分かる名前に（例: user_name）。数字から始めることはできません。`,
  exercises: [
    { id: 'd1-1', title: 'チーム名ジェネレーター', prompt: '好きな色と好きな動物を input() で聞き、`チーム名は「(色)(動物)ズ」です` と表示しよう。\n\n例: 色「レッド」動物「タイガー」→ `チーム名は「レッドタイガーズ」です`',
      starter: 'color = input("好きな色は？ ")\n# 動物も聞こう\n\n# チーム名を表示しよう\n',
      tests: [
        { name: 'レッド＋タイガー', inputs: ['レッド', 'タイガー'], check: 'assert "チーム名は「レッドタイガーズ」です" in __out__, "表示が「チーム名は「レッドタイガーズ」です」になっていません"' },
        { name: 'ブルー＋シャーク', inputs: ['ブルー', 'シャーク'], check: 'assert "「ブルーシャークズ」" in __out__, "入力した値が使われていますか？"' }],
      hint: 'animal = input("好きな動物は？ ") で受け取り、"チーム名は「" + color + animal + "ズ」です" のように + でつなぎます。',
      solution: 'color = input("好きな色は？ ")\nanimal = input("好きな動物は？ ")\nprint("チーム名は「" + color + animal + "ズ」です")\n' },
  ],
},
{
  day: 2, title: 'データ型・計算・f文字列', review: true,
  goal: 'int / float / str / bool と型変換、算術演算子、f文字列',
  lesson: `### 主なデータ型
| 型 | 例 |
|---|---|
| int（整数） | 42 |
| float（小数） | 3.14 |
| str（文字列） | "abc" |
| bool（真偽） | True / False |

\`type(x)\` で型を確認、\`int()\` \`float()\` \`str()\` で変換します。**input() の結果は文字列**なので計算には変換が必要です。
\`\`\`python
age = int(input("年齢: "))
print(age + 1)
\`\`\`
### 演算子
\`+ - * /\`（/ は常に float）、\`//\`（切り捨て除算）、\`%\`（余り）、\`**\`（べき乗）。優先順位は数学と同じで、カッコが最優先。
### 丸めと f文字列
\`\`\`python
bmi = 60 / 1.7 ** 2
print(round(bmi, 1))         # 20.8
print(f"BMIは{bmi:.1f}です")   # f文字列。:.1f で小数1桁
\`\`\``,
  exercises: [
    { id: 'd2-1', title: '割り勘計算', prompt: '合計金額（円）、チップの割合（%）、人数を入力し、1人あたりの金額を**小数第1位まで**表示しよう。\n\n表示形式: `1人あたり 3666.7 円`\n（例: 10000円、チップ10%、3人 → 10000×1.1÷3 = 3666.66… → 3666.7）',
      starter: 'total = float(input("合計金額は？ "))\ntip = int(input("チップは何%？ "))\npeople = int(input("何人で割る？ "))\n\n',
      tests: [
        { name: '10000円/10%/3人', inputs: ['10000', '10', '3'], check: 'assert "1人あたり 3666.7 円" in __out__, "期待: 1人あたり 3666.7 円"' },
        { name: '5000円/0%/2人', inputs: ['5000', '0', '2'], check: 'assert "1人あたり 2500.0 円" in __out__, "期待: 1人あたり 2500.0 円（:.1f を使うと .0 も表示されます）"' }],
      hint: 'per = total * (1 + tip / 100) / people を計算し、print(f"1人あたり {per:.1f} 円")',
      solution: 'total = float(input("合計金額は？ "))\ntip = int(input("チップは何%？ "))\npeople = int(input("何人で割る？ "))\nper = total * (1 + tip / 100) / people\nprint(f"1人あたり {per:.1f} 円")\n' },
  ],
},
{
  day: 3, title: '条件分岐 if / elif / else', review: true,
  goal: '比較演算子・論理演算子で処理を分ける',
  lesson: `### if 文
\`\`\`python
height = int(input("身長(cm): "))
if height >= 120:
    print("乗れます")
else:
    print("乗れません")
\`\`\`
- 比較: \`> < >= <= == !=\`（等しいは \`==\`）
- **コロン \`:\` とインデント（スペース4つ）**がブロックの目印
### elif と論理演算子
\`\`\`python
if age < 12:
    price = 500
elif age <= 18:
    price = 700
else:
    price = 1200
if age >= 45 and age <= 55:   # and / or / not
    price = 0
\`\`\`
> 偶数判定は \`n % 2 == 0\`。うるう年は「4で割り切れる、ただし100で割り切れる年は除く、ただし400で割り切れる年はうるう年」。`,
  exercises: [
    { id: 'd3-1', title: 'うるう年判定', prompt: '西暦を入力し、うるう年なら `うるう年です`、そうでなければ `うるう年ではありません` と表示しよう。',
      starter: 'year = int(input("西暦は？ "))\n',
      tests: [
        { name: '2024', inputs: ['2024'], check: 'assert "うるう年です" in __out__ and "ではありません" not in __out__, "2024年はうるう年"' },
        { name: '1900', inputs: ['1900'], check: 'assert "うるう年ではありません" in __out__, "1900年は100で割り切れるのでうるう年ではない"' },
        { name: '2000', inputs: ['2000'], check: 'assert "うるう年です" in __out__ and "ではありません" not in __out__, "2000年は400で割り切れるのでうるう年"' },
        { name: '2023', inputs: ['2023'], check: 'assert "うるう年ではありません" in __out__, "2023年はうるう年ではない"' }],
      hint: 'if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0):',
      solution: 'year = int(input("西暦は？ "))\nif year % 4 == 0 and (year % 100 != 0 or year % 400 == 0):\n    print("うるう年です")\nelse:\n    print("うるう年ではありません")\n' },
  ],
},
{
  day: 4, title: 'random とリスト', review: true,
  goal: '乱数、リストの作成・インデックス・追加、ネストしたリスト',
  lesson: `### random モジュール
\`\`\`python
import random
print(random.randint(1, 6))        # 1〜6 の整数
print(random.random())             # 0.0〜1.0 未満
print(random.choice(["グー", "チョキ", "パー"]))
\`\`\`
### リスト
\`\`\`python
fruits = ["りんご", "みかん", "ぶどう"]
print(fruits[0])      # りんご（0から数える）
print(fruits[-1])     # ぶどう（後ろから）
fruits.append("もも")
fruits[1] = "レモン"
print(len(fruits))    # 4
grid = [["a", "b"], ["c", "d"]]
print(grid[1][0])     # c
\`\`\`
> IndexError: list index out of range は「範囲外の番号」。長さ3のリストのインデックスは 0〜2 です。`,
  exercises: [
    { id: 'd4-1', title: '今日のおごり当番', prompt: 'カンマ区切りで名前を入力（例: `たろう,はなこ,じろう`）し、その中からランダムに1人選んで `今日のおごりは じろう さんです` と表示しよう。\n\n文字列の `split(",")` でリストにできます。',
      starter: 'import random\nnames_text = input("名前をカンマ区切りで: ")\nnames = names_text.split(",")\n',
      tests: [
        { name: '3人から選ぶ', inputs: ['たろう,はなこ,じろう'], check: 'import re\nm = re.search(r"今日のおごりは (.+) さんです", __out__)\nassert m, "「今日のおごりは ○○ さんです」の形式で表示しよう"\nassert m.group(1) in ["たろう","はなこ","じろう"], "入力した名前から選ばれていません"' },
        { name: '1人だけ', inputs: ['さくら'], check: 'assert "今日のおごりは さくら さんです" in __out__, "1人ならその人が選ばれるはず"' }],
      hint: 'who = random.choice(names) で1人選べます。',
      solution: 'import random\nnames_text = input("名前をカンマ区切りで: ")\nnames = names_text.split(",")\nwho = random.choice(names)\nprint(f"今日のおごりは {who} さんです")\n' },
  ],
},
{
  day: 5, title: 'for ループと range', review: true,
  goal: 'リストの繰り返し、range、合計・最大値を自分で求める',
  lesson: `### for ループ
\`\`\`python
for fruit in ["りんご", "みかん"]:
    print(fruit + "が好き")
for i in range(1, 6):     # 1,2,3,4,5（終わりの数は含まない）
    print(i)
for i in range(0, 10, 2): # 0,2,4,6,8（ステップ2）
    print(i)
\`\`\`
### 合計と最大値
\`\`\`python
scores = [72, 88, 95, 60]
total = 0
best = scores[0]
for s in scores:
    total += s
    if s > best:
        best = s
print(total, best)   # sum(scores), max(scores) と同じ
\`\`\`
> FizzBuzz: 3の倍数で Fizz、5の倍数で Buzz、両方の倍数で FizzBuzz。15の倍数の判定を**先に**書くのがコツ。`,
  exercises: [
    { id: 'd5-1', title: 'FizzBuzz', prompt: '1 から 30 まで、3の倍数なら `Fizz`、5の倍数なら `Buzz`、両方なら `FizzBuzz`、それ以外は数字を1行ずつ表示しよう。',
      starter: 'for n in range(1, 31):\n    pass  # ここを書き換えよう\n',
      tests: [{ name: '1〜30', inputs: [], check: 'exp = ["FizzBuzz" if n%15==0 else "Fizz" if n%3==0 else "Buzz" if n%5==0 else str(n) for n in range(1,31)]\nassert __lines__ == exp, "1〜30 の30行を出力しよう。最初の数行: " + " ".join(exp[:6])' }],
      hint: 'if n % 15 == 0: → elif n % 3 == 0: → elif n % 5 == 0: → else: の順に。',
      solution: 'for n in range(1, 31):\n    if n % 15 == 0:\n        print("FizzBuzz")\n    elif n % 3 == 0:\n        print("Fizz")\n    elif n % 5 == 0:\n        print("Buzz")\n    else:\n        print(n)\n' },
    { id: 'd5-2', title: 'max を使わずに最高点', prompt: 'スペース区切りの点数（例: `72 88 95 60`）を入力し、`max()` や `sum()` を使わずに、`合計: 315` と `最高: 95` を表示しよう。',
      starter: 'scores = [int(s) for s in input("点数: ").split()]\n# max() と sum() は使わないこと\n',
      tests: [
        { name: '72 88 95 60', inputs: ['72 88 95 60'], check: 'assert "合計: 315" in __out__ and "最高: 95" in __out__, "合計: 315 / 最高: 95 になるはず"' },
        { name: '負の数を含む', inputs: ['-5 -2 -9'], check: 'assert "最高: -2" in __out__, "最初の値を best の初期値にしよう（0 から始めると負の数で失敗）"' }],
      hint: 'best = scores[0] から始めて、for で大きい値が来たら更新します。',
      solution: 'scores = [int(s) for s in input("点数: ").split()]\ntotal = 0\nbest = scores[0]\nfor s in scores:\n    total += s\n    if s > best:\n        best = s\nprint(f"合計: {total}")\nprint(f"最高: {best}")\n' },
  ],
},
{
  day: 6, title: '関数と while ループ', review: true,
  goal: 'def で関数を定義し、while で条件付きの繰り返しをする',
  lesson: `### 関数の定義
\`\`\`python
def greet():
    print("おはよう")
    print("今日もがんばろう")

greet()   # 呼び出し
\`\`\`
### while ループ
条件が True の間くり返します。条件がいつか False にならないと**無限ループ**になります。
\`\`\`python
n = 3
while n > 0:
    print(n)
    n -= 1
print("発射！")
\`\`\`
> for は「回数や要素が決まっているとき」、while は「条件を満たすまで」のときに使います。`,
  exercises: [
    { id: 'd6-1', title: '貯金シミュレーター', prompt: '目標金額を入力し、毎月 3000 円ずつ貯金したとき、何か月で目標に到達するかを while で求め、`12か月で達成` のように表示しよう。',
      starter: 'goal = int(input("目標金額: "))\nsaved = 0\nmonths = 0\n',
      tests: [
        { name: '36000円', inputs: ['36000'], check: 'assert "12か月で達成" in __out__, "36000円なら12か月"' },
        { name: '10000円', inputs: ['10000'], check: 'assert "4か月で達成" in __out__, "10000円なら4か月（3000×4=12000）"' }],
      hint: 'while saved < goal: の中で saved += 3000 と months += 1。',
      solution: 'goal = int(input("目標金額: "))\nsaved = 0\nmonths = 0\nwhile saved < goal:\n    saved += 3000\n    months += 1\nprint(f"{months}か月で達成")\n' },
  ],
},
{
  day: 7, title: 'ミニプロジェクト：単語当てゲーム', review: true, project: true,
  goal: 'ループ・条件分岐・リストを組み合わせてゲームを作る',
  lesson: `### ゲームの流れ
1. 答えの単語を決める（今回は練習のため固定: \`python\`）
2. 画面には \`_ _ _ _ _ _\` のように伏せ字を表示
3. 1文字ずつ予想させ、当たればその位置を公開、外れればライフ -1
4. 全部当てたら勝ち、ライフ 0 で負け

\`\`\`python
word = "python"
display = ["_"] * len(word)
for i, ch in enumerate(word):   # i が位置、ch が文字
    if ch == "t":
        display[i] = ch
print(" ".join(display))   # _ _ t _ _ _
\`\`\`
> \`"_" not in display\` で「全部当てたか」を判定できます。`,
  exercises: [
    { id: 'd7-1', title: '単語当てゲーム', prompt: '答え `python`、ライフ 3 の単語当てゲームを作ろう。\n- 毎回 `_ _ t _ _ _` の形式で伏せ字を表示してから input で1文字聞く\n- 外れたら `はずれ！残りライフ 2`\n- 全部当てたら `正解！ python`、ライフが 0 になったら `ゲームオーバー 答えは python`',
      starter: 'word = "python"\nlives = 3\ndisplay = ["_"] * len(word)\n\n',
      tests: [
        { name: '全部当てる', inputs: ['p', 'y', 't', 'h', 'o', 'n'], check: 'assert "正解！ python" in __out__, "全部当てたら「正解！ python」"\nassert "_ _ _ _ _ _" in __out__, "最初に伏せ字「_ _ _ _ _ _」を表示しよう"' },
        { name: '3回外す', inputs: ['a', 'b', 'c'], check: 'assert "はずれ！残りライフ 2" in __out__, "外れたら「はずれ！残りライフ 2」"\nassert "ゲームオーバー 答えは python" in __out__, "ライフ0で「ゲームオーバー 答えは python」"' },
        { name: '途中で外しても勝てる', inputs: ['z', 'p', 'y', 't', 'h', 'o', 'n'], check: 'assert "正解！ python" in __out__ and "はずれ！残りライフ 2" in __out__, "1回外しても勝てるはず"' }],
      hint: 'while "_" in display and lives > 0: の中で表示 → input → 当たり判定。ループの後で勝敗を表示します。',
      solution: 'word = "python"\nlives = 3\ndisplay = ["_"] * len(word)\n\nwhile "_" in display and lives > 0:\n    print(" ".join(display))\n    guess = input("1文字: ").lower()\n    if guess in word:\n        for i, ch in enumerate(word):\n            if ch == guess:\n                display[i] = ch\n    else:\n        lives -= 1\n        print(f"はずれ！残りライフ {lives}")\n\nif "_" not in display:\n    print("正解！ " + word)\nelse:\n    print("ゲームオーバー 答えは " + word)\n' },
  ],
},
{
  day: 8, title: '引数のある関数', review: true,
  goal: '引数（パラメータ）、位置引数とキーワード引数',
  lesson: `### 引数
\`\`\`python
def greet(name, time="朝"):      # time はデフォルト値つき
    print(f"{name}さん、{time}ですね")

greet("たろう")                   # 位置引数
greet(time="夜", name="はなこ")   # キーワード引数（順番自由）
\`\`\`
### シーザー暗号
アルファベットを決まった数だけずらす暗号です。
\`\`\`python
alphabet = "abcdefghijklmnopqrstuvwxyz"
i = alphabet.index("y")           # 24
print(alphabet[(i + 3) % 26])     # b（% 26 で一周する）
\`\`\``,
  exercises: [
    { id: 'd8-1', title: 'シーザー暗号', prompt: '関数 `caesar(text, shift)` を作ろう。小文字アルファベットを shift 文字ずらし、それ以外（数字・記号・空白）はそのまま返す。shift が負なら逆方向（復号）。\n\n例: `caesar("hello world!", 3)` → `"khoor zruog!"`',
      starter: 'alphabet = "abcdefghijklmnopqrstuvwxyz"\n\ndef caesar(text, shift):\n    result = ""\n    # ここを書こう\n    return result\n\nprint(caesar("hello world!", 3))\n',
      tests: [
        { name: '暗号化', check: 'assert caesar("hello world!", 3) == "khoor zruog!", "caesar(\\"hello world!\\", 3) は \\"khoor zruog!\\""' },
        { name: '一周する', check: 'assert caesar("xyz", 3) == "abc", "z の次は a に戻る（% 26）"' },
        { name: '復号', check: 'assert caesar("khoor", -3) == "hello", "shift が負なら戻す"' }],
      hint: 'for ch in text: で、ch が alphabet にあれば alphabet[(alphabet.index(ch) + shift) % 26] を足し、なければ ch をそのまま足します。',
      solution: 'alphabet = "abcdefghijklmnopqrstuvwxyz"\n\ndef caesar(text, shift):\n    result = ""\n    for ch in text:\n        if ch in alphabet:\n            result += alphabet[(alphabet.index(ch) + shift) % 26]\n        else:\n            result += ch\n    return result\n\nprint(caesar("hello world!", 3))\n' },
  ],
},
{
  day: 9, title: '辞書とネスト', review: true,
  goal: '辞書（dict）の作成・追加・ループ、リストと辞書の入れ子',
  lesson: `### 辞書
キーと値のペアでデータを持ちます。
\`\`\`python
scores = {"たろう": 81, "はなこ": 92}
print(scores["はなこ"])     # 92
scores["じろう"] = 67       # 追加
for name in scores:          # キーでループ
    print(name, scores[name])
for name, s in scores.items():   # キーと値を同時に
    print(name, s)
\`\`\`
### ネスト（入れ子）
\`\`\`python
travel = [
    {"国": "フランス", "都市": ["パリ", "リヨン"]},
    {"国": "日本", "都市": ["京都"]},
]
print(travel[0]["都市"][1])   # リヨン
\`\`\``,
  exercises: [
    { id: 'd9-1', title: '成績を評価に変換', prompt: '関数 `grade_all(scores)` を作ろう。名前→点数の辞書を受け取り、名前→評価の**新しい辞書**を返す。\n- 90以上 `S` / 80以上 `A` / 70以上 `B` / それ未満 `C`',
      starter: 'def grade_all(scores):\n    grades = {}\n    # ここを書こう\n    return grades\n\nprint(grade_all({"たろう": 81, "はなこ": 92, "じろう": 67}))\n',
      tests: [{ name: '3人', check: 'r = grade_all({"たろう": 81, "はなこ": 92, "じろう": 67, "さくら": 70})\nassert r == {"たろう": "A", "はなこ": "S", "じろう": "C", "さくら": "B"}, f"結果: {r}"' }],
      hint: 'for name, s in scores.items(): で点数を判定して grades[name] = "A" のように入れます。',
      solution: 'def grade_all(scores):\n    grades = {}\n    for name, s in scores.items():\n        if s >= 90:\n            grades[name] = "S"\n        elif s >= 80:\n            grades[name] = "A"\n        elif s >= 70:\n            grades[name] = "B"\n        else:\n            grades[name] = "C"\n    return grades\n\nprint(grade_all({"たろう": 81, "はなこ": 92, "じろう": 67}))\n' },
    { id: 'd9-2', title: '秘密のオークション', prompt: '入札者の名前と金額を繰り返し入力し、`続ける？(y/n)` に n が入力されたら終了。最高額の人を `落札者は はなこ さん（5000円）` と表示しよう。',
      starter: 'bids = {}\n\n',
      tests: [{ name: '3人', inputs: ['たろう', '3000', 'y', 'はなこ', '5000', 'y', 'じろう', '4000', 'n'], check: 'assert "落札者は はなこ さん（5000円）" in __out__, "最高額は はなこ の 5000円"' }],
      hint: 'while True: で 名前→金額→続ける？ を聞き、n なら break。最後に for で最大を探すか max(bids, key=bids.get)。',
      solution: 'bids = {}\nwhile True:\n    name = input("名前: ")\n    bids[name] = int(input("金額: "))\n    if input("続ける？(y/n) ") == "n":\n        break\nwinner = max(bids, key=bids.get)\nprint(f"落札者は {winner} さん（{bids[winner]}円）")\n' },
  ],
},
{
  day: 10, title: '戻り値のある関数', review: true,
  goal: 'return、複数の return、docstring、関数を組み合わせる',
  lesson: `### return
\`\`\`python
def area(w, h):
    """長方形の面積を返す"""    # docstring（関数の説明）
    return w * h

a = area(3, 4)       # 戻り値を変数に入れる
print(area(2, 5) + a)
\`\`\`
- return に来ると関数はそこで終了します
- 条件ごとに別の return を書くこともできます
\`\`\`python
def sign(n):
    if n > 0:
        return "プラス"
    if n < 0:
        return "マイナス"
    return "ゼロ"
\`\`\`
> 関数の中で print するか return するかは大事な違い。**return した値は呼び出し側で再利用できます**。`,
  exercises: [
    { id: 'd10-1', title: '月の日数', prompt: '`is_leap(year)` と `days_in_month(year, month)` を作ろう。days_in_month は is_leap を使って2月の日数を判定する。\n\n例: `days_in_month(2024, 2)` → 29、`days_in_month(2023, 4)` → 30',
      starter: 'def is_leap(year):\n    pass\n\ndef days_in_month(year, month):\n    days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]\n    pass\n\nprint(days_in_month(2024, 2))\n',
      tests: [
        { name: 'is_leap', check: 'assert is_leap(2024) is True and is_leap(1900) is False and is_leap(2000) is True, "is_leap が True/False を返すようにしよう"' },
        { name: '日数', check: 'assert days_in_month(2024, 2) == 29 and days_in_month(2023, 2) == 28 and days_in_month(2023, 4) == 30 and days_in_month(2023, 12) == 31, "days_in_month の結果が違います"' }],
      hint: 'is_leap は return year % 4 == 0 and (...) の1行で書けます。days_in_month は month == 2 and is_leap(year) なら 29、それ以外は days[month - 1]。',
      solution: 'def is_leap(year):\n    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)\n\ndef days_in_month(year, month):\n    days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]\n    if month == 2 and is_leap(year):\n        return 29\n    return days[month - 1]\n\nprint(days_in_month(2024, 2))\n' },
  ],
},
{
  day: 11, title: '総合プロジェクト：カードゲーム「21」', project: true,
  goal: 'これまでの知識（関数・リスト・ループ・条件・random）を組み合わせて本格的なゲームを作る',
  lesson: `### ルール（今回の簡易版）
- カードは \`[11, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10]\`（11はエース、10が絵札）から無限に引ける
- 最初に自分とディーラーが2枚ずつ引く。ディーラーの1枚目だけ見える
- 自分は「もう1枚」か「勝負」を選ぶ。合計が21を超えたら負け（バースト）
- エースは11だが、合計が21を超えるなら1として数える
- 最初の2枚で21（エース＋10）は「ナチュラル21」で特別扱い（スコア 0 と表現する）
- ディーラーは合計が17未満なら引き続ける

### 大きな問題は小さな関数に分ける
\`\`\`python
def deal_card():          # 1枚引く
def calculate_score(cards):   # 合計を計算（エース・ナチュラル21の処理）
def compare(user, dealer):    # 勝敗を文字列で返す
\`\`\`
それぞれの関数を**個別にテストしながら**作り、最後に組み立てます。これは実際の開発でも同じ考え方です。

### 便利な道具
\`\`\`python
sum([11, 10])        # 合計 21
cards.remove(11)     # 最初の 11 を削除
cards.append(1)
11 in cards          # 含まれているか
\`\`\`
> 先にフローチャート（流れ図）を描いてから書き始めると迷いません。紙に「開始 → 2枚配る → スコア計算 → …」と書いてみましょう。`,
  exercises: [
    { id: 'd11-1', title: 'ステップ1：スコア計算', prompt: '`calculate_score(cards)` を作ろう。\n- カードが2枚で合計21なら **0** を返す（ナチュラル21）\n- 11 が含まれていて合計が21を超えるなら、11 を 1 に置き換える（複数あれば必要なだけ）\n- それ以外は合計を返す',
      starter: 'def calculate_score(cards):\n    """カードのリストから得点を返す。ナチュラル21は0"""\n    pass\n\nprint(calculate_score([11, 10]))     # 0\nprint(calculate_score([11, 9, 5]))   # 15\n',
      tests: [
        { name: 'ナチュラル21', check: 'assert calculate_score([11, 10]) == 0, "[11, 10] はナチュラル21なので 0"' },
        { name: '普通の合計', check: 'assert calculate_score([5, 7]) == 12 and calculate_score([10, 10, 10]) == 30, "エースがないときはそのまま合計"' },
        { name: 'エースを1に', check: 'assert calculate_score([11, 9, 5]) == 15, "[11, 9, 5] は 25 → エースを1にして 15"' },
        { name: 'エース2枚', check: 'assert calculate_score([11, 11, 9]) == 21, "[11, 11, 9] は 31 → 21（1枚だけ1にすれば足りる）"' },
        { name: '3枚で21はナチュラルではない', check: 'assert calculate_score([7, 7, 7]) == 21, "3枚の21は普通の21"' }],
      hint: 'まず if len(cards) == 2 and sum(cards) == 21: return 0。次に while 11 in cards and sum(cards) > 21: で remove(11) と append(1)。元のリストを変えたくなければ cards = list(cards) でコピー。',
      solution: 'def calculate_score(cards):\n    """カードのリストから得点を返す。ナチュラル21は0"""\n    cards = list(cards)\n    if len(cards) == 2 and sum(cards) == 21:\n        return 0\n    while 11 in cards and sum(cards) > 21:\n        cards.remove(11)\n        cards.append(1)\n    return sum(cards)\n\nprint(calculate_score([11, 10]))\nprint(calculate_score([11, 9, 5]))\n' },
    { id: 'd11-2', title: 'ステップ2：勝敗判定', prompt: '`compare(user, dealer)` を作ろう（引数はスコア。0 はナチュラル21）。上から順に判定:\n1. 同点 → `"引き分け"`\n2. dealer が 0 → `"負け（相手がナチュラル21）"`\n3. user が 0 → `"勝ち（ナチュラル21）"`\n4. user が21超 → `"負け（バースト）"`\n5. dealer が21超 → `"勝ち（相手がバースト）"`\n6. user が大きい → `"勝ち"`、それ以外 → `"負け"`',
      starter: 'def compare(user, dealer):\n    pass\n\nprint(compare(20, 18))\n',
      tests: [
        { name: '基本', check: 'assert compare(20, 18) == "勝ち" and compare(17, 19) == "負け" and compare(18, 18) == "引き分け", "勝ち/負け/引き分けの基本"' },
        { name: 'ナチュラル21', check: 'assert compare(0, 20) == "勝ち（ナチュラル21）" and compare(20, 0) == "負け（相手がナチュラル21）", "スコア0はナチュラル21"' },
        { name: 'バースト', check: 'assert compare(23, 18) == "負け（バースト）" and compare(18, 25) == "勝ち（相手がバースト）", "21を超えたらバースト"' },
        { name: '両方バースト', check: 'assert compare(24, 26) == "負け（バースト）", "両方バーストなら自分の負け（自分が先にバーストしているため）"' }],
      hint: 'if / elif を問題文の順番どおりに並べ、それぞれ return します。',
      solution: 'def compare(user, dealer):\n    if user == dealer:\n        return "引き分け"\n    elif dealer == 0:\n        return "負け（相手がナチュラル21）"\n    elif user == 0:\n        return "勝ち（ナチュラル21）"\n    elif user > 21:\n        return "負け（バースト）"\n    elif dealer > 21:\n        return "勝ち（相手がバースト）"\n    elif user > dealer:\n        return "勝ち"\n    else:\n        return "負け"\n\nprint(compare(20, 18))\n' },
    { id: 'd11-3', title: 'ステップ3：ゲームを完成させる', prompt: 'ステップ1・2の関数を使ってゲームを完成させよう。\n- `deal_card()` は `random.choice(cards)` で1枚返す\n- 毎ターン `あなたの手札: [10, 5] 合計: 15` と `ディーラーの1枚目: 7` を表示\n- `もう1枚引く？(y/n) ` で y なら引く。スコアが0か21超えになったら自動で終了\n- その後ディーラーは 17 未満の間引く（0 なら引かない）\n- 最後に `ディーラーの手札: [...] 合計: ...` と勝敗を表示\n\n▶ 実行ボタンで遊んでみよう（入力欄が出ます）',
      starter: 'import random\n\ndef deal_card():\n    cards = [11, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10]\n    return random.choice(cards)\n\n# ステップ1・2の calculate_score と compare をここに貼ろう\n\n\nuser_cards = [deal_card(), deal_card()]\ndealer_cards = [deal_card(), deal_card()]\n',
      tests: [
        { name: '最後まで遊べる（すぐ勝負）', inputs: ['n', 'n', 'n', 'n'], check: 'assert "あなたの手札:" in __out__ and "ディーラーの手札:" in __out__, "手札と結果を表示しよう"\nassert any(w in __out__ for w in ["勝ち", "負け", "引き分け"]), "勝敗を表示しよう"' },
        { name: '何枚か引く', inputs: ['y', 'y', 'y', 'y', 'y', 'y', 'y', 'y', 'y', 'y'], check: 'assert any(w in __out__ for w in ["勝ち", "負け", "引き分け"]), "引き続けても最後は勝敗が出るはず（バーストで自動終了）"' }],
      hint: 'game_over = False; while not game_over: でスコア計算 → 表示 → (0 か 21超なら game_over=True) → そうでなければ input で y/n。ディーラーは while dealer_score != 0 and dealer_score < 17:',
      solution: 'import random\n\ndef deal_card():\n    cards = [11, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10]\n    return random.choice(cards)\n\ndef calculate_score(cards):\n    cards = list(cards)\n    if len(cards) == 2 and sum(cards) == 21:\n        return 0\n    while 11 in cards and sum(cards) > 21:\n        cards.remove(11)\n        cards.append(1)\n    return sum(cards)\n\ndef compare(user, dealer):\n    if user == dealer:\n        return "引き分け"\n    elif dealer == 0:\n        return "負け（相手がナチュラル21）"\n    elif user == 0:\n        return "勝ち（ナチュラル21）"\n    elif user > 21:\n        return "負け（バースト）"\n    elif dealer > 21:\n        return "勝ち（相手がバースト）"\n    elif user > dealer:\n        return "勝ち"\n    else:\n        return "負け"\n\nuser_cards = [deal_card(), deal_card()]\ndealer_cards = [deal_card(), deal_card()]\n\ngame_over = False\nwhile not game_over:\n    user_score = calculate_score(user_cards)\n    dealer_score = calculate_score(dealer_cards)\n    print(f"あなたの手札: {user_cards} 合計: {user_score}")\n    print(f"ディーラーの1枚目: {dealer_cards[0]}")\n    if user_score == 0 or dealer_score == 0 or user_score > 21:\n        game_over = True\n    elif input("もう1枚引く？(y/n) ") == "y":\n        user_cards.append(deal_card())\n    else:\n        game_over = True\n\nwhile dealer_score != 0 and dealer_score < 17:\n    dealer_cards.append(deal_card())\n    dealer_score = calculate_score(dealer_cards)\n\nprint(f"ディーラーの手札: {dealer_cards} 合計: {dealer_score}")\nprint(compare(user_score, dealer_score))\n' },
  ],
},
{
  day: 12, title: 'スコープと数当てゲーム',
  goal: 'ローカル変数とグローバル変数の違い、global、定数の書き方を理解する',
  lesson: `### スコープ（変数が使える範囲）
関数の中で作った変数は**ローカル変数**で、関数の外からは見えません。
\`\`\`python
def make_potion():
    strength = 2       # ローカル
    print(strength)

make_potion()
print(strength)        # NameError！
\`\`\`
関数の外（ファイルの一番外側）で作った変数は**グローバル変数**で、関数の中から**読む**ことはできます。

> Python では if や for のブロックは新しいスコープを作りません。スコープを作るのは**関数**（とクラス）です。

### グローバル変数を書き換えるには
\`\`\`python
enemies = 1
def increase():
    global enemies     # これがないと UnboundLocalError
    enemies += 1
\`\`\`
ただし global の多用はバグのもと。**引数で受け取り、return で返す**ほうが安全です。
\`\`\`python
def increase(enemies):
    return enemies + 1
enemies = increase(enemies)
\`\`\`
### 定数
変更しない値は大文字で書く習慣があります（Python が強制するわけではありません）。
\`\`\`python
EASY_TURNS = 10
HARD_TURNS = 5
\`\`\``,
  exercises: [
    { id: 'd12-1', title: 'バグ修正：UnboundLocalError', prompt: '下のコードを実行するとエラーになります。**global を使わずに**、引数と戻り値を使う形に直そう。最後に `スコア: 30` と表示されればOK。\n\n関数 `add_points(score, points)` は新しいスコアを返すこと。',
      starter: 'score = 0\n\ndef add_points(points):\n    score += points\n\nadd_points(10)\nadd_points(20)\nprint(f"スコア: {score}")\n',
      tests: [
        { name: '出力', check: 'assert "スコア: 30" in __out__, "最後に「スコア: 30」と表示しよう"' },
        { name: '関数の形', check: 'assert add_points(5, 3) == 8, "add_points(score, points) が合計を return するようにしよう"' },
        { name: 'global 不使用', check: 'assert "global" not in __code_src__, "global を使わずに書いてみよう"' }],
      hint: 'def add_points(score, points): return score + points として、score = add_points(score, 10) のように受け取ります。',
      solution: 'score = 0\n\ndef add_points(score, points):\n    return score + points\n\nscore = add_points(score, 10)\nscore = add_points(score, 20)\nprint(f"スコア: {score}")\n' },
    { id: 'd12-2', title: '数当てゲーム', prompt: '1〜100 の数を当てるゲーム。\n- 最初に `難易度は？(easy/hard) ` と聞き、easy なら10回、hard なら5回まで\n- 毎回 `残り 5 回` と表示してから `予想: ` で数を聞く\n- 大きすぎ→ `大きすぎます`、小さすぎ→ `小さすぎます`、正解→ `正解！ 答えは 42`\n- 回数を使い切ったら `残念… 答えは 42`\n- 定数 `EASY_TURNS` `HARD_TURNS` と、関数 `check_answer(guess, answer, turns)`（残り回数を返す）を使おう\n\n※テストでは答えを固定するため、答えは `answer = random.randint(1, 100)` で決めること',
      starter: 'import random\n\nEASY_TURNS = 10\nHARD_TURNS = 5\n\ndef check_answer(guess, answer, turns):\n    """判定を表示し、残り回数を返す"""\n    pass\n\nanswer = random.randint(1, 100)\n',
      tests: [
        { name: 'hard で二分探索して当てる', inputs: ['hard', '50', '25', '12', '18', '17', '16', '15', '14', '13'], check: 'import random\nrandom.seed(1)\nans = random.randint(1, 100)\nassert ("正解！ 答えは %d" % ans) in __out__ or ("残念… 答えは %d" % ans) in __out__, "最後に「正解！ 答えは N」か「残念… 答えは N」を表示しよう"\nassert "残り 5 回" in __out__, "hard は5回。「残り 5 回」と表示しよう"' },
        { name: 'easy は10回', inputs: ['easy', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1'], check: 'assert "残り 10 回" in __out__ and "残念… 答えは" in __out__, "easy は10回で、使い切ったら「残念… 答えは N」"\nassert __out__.count("予想:") == 10, "10回聞くはず"' },
        { name: 'check_answer', inputs: ['hard', '1', '1', '1', '1', '1'], check: 'assert check_answer(80, 42, 5) == 4 and check_answer(10, 42, 3) == 2, "外れたら turns - 1 を返そう"' }],
      hint: 'turns = EASY_TURNS if level == "easy" else HARD_TURNS。while turns > 0: の中で表示・入力し、guess == answer なら正解を表示して break、違えば turns = check_answer(...)。while の else 節（break されなかったとき実行）で「残念…」を出せます。',
      solution: 'import random\n\nEASY_TURNS = 10\nHARD_TURNS = 5\n\ndef check_answer(guess, answer, turns):\n    """判定を表示し、残り回数を返す"""\n    if guess > answer:\n        print("大きすぎます")\n    elif guess < answer:\n        print("小さすぎます")\n    return turns - 1\n\nanswer = random.randint(1, 100)\nlevel = input("難易度は？(easy/hard) ")\nturns = EASY_TURNS if level == "easy" else HARD_TURNS\n\nwhile turns > 0:\n    print(f"残り {turns} 回")\n    guess = int(input("予想: "))\n    if guess == answer:\n        print(f"正解！ 答えは {answer}")\n        break\n    turns = check_answer(guess, answer, turns)\nelse:\n    print(f"残念… 答えは {answer}")\n' },
  ],
},
{
  day: 13, title: 'デバッグの技術',
  goal: 'エラーメッセージの読み方、print デバッグ、よくあるバグのパターン',
  lesson: `### デバッグの手順
1. **問題を説明する**：何を期待して、実際は何が起きたか
2. **再現する**：毎回起きるか、特定の入力だけか
3. **コンピューターになったつもりで1行ずつ追う**
4. **エラーメッセージを読む**：一番下の行が種類と内容、その上が場所（行番号）
5. **print() で途中の値を確認する**
6. **小さく分けて試す**、それでもダメなら**休憩**してから見直す

### エラーメッセージの読み方
\`\`\`text
Traceback (most recent call last):
  File "main.py", line 3, in <module>
    print(age + 1)
TypeError: can only concatenate str (not "int") to str
\`\`\`
→ 3行目で、文字列に整数を + しようとした。age が文字列のまま（int() し忘れ）。

### よくあるバグ
- range の終わりの数は含まれない（\`range(1, 10)\` は 9 まで）
- \`=\`（代入）と \`==\`（比較）の取り違え
- インデントのずれで、ループの外に出るはずの行が中に入っている
- リストのインデックスは 0 から
- input() の値は文字列

> AI（Claude など）にエラーを聞くときも、**エラーメッセージ全文＋コード＋期待した動き**を伝えると一発で解決しやすくなります。`,
  exercises: [
    { id: 'd13-1', title: 'バグ探し①：サイコロ', prompt: '1〜6 の目を出すはずが、ときどき IndexError になります。バグを直そう。\n（リストの長さとインデックスの範囲を考えよう）',
      starter: 'import random\ndice = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"]\nfor _ in range(20):\n    n = random.randint(1, 6)\n    print(dice[n])\n',
      tests: [{ name: '20回振る', check: 'import random\nfor seed in range(40):\n    random.seed(seed)\n    try:\n        exec(__code_src__, {})\n    except IndexError:\n        assert False, "まだ IndexError が起きることがあります（randint(1, 6) とインデックス 0〜5 の関係を確認）"\nassert len(__lines__) == 20, "20回表示しよう"' }],
      hint: 'リストのインデックスは 0〜5。randint(1, 6) で 6 が出ると dice[6] は範囲外。randint(0, 5) にするか dice[n - 1] にします。',
      solution: 'import random\ndice = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"]\nfor _ in range(20):\n    n = random.randint(1, 6)\n    print(dice[n - 1])\n' },
    { id: 'd13-2', title: 'バグ探し②：世代判定', prompt: '生まれ年から世代を表示するはずが、1994年を入力しても何も表示されません。直そう。\n- 1980〜1994 → `ミレニアル世代`、1995〜2012 → `Z世代`',
      starter: 'year = int(input("生まれ年: "))\nif year > 1980 and year < 1994:\n    print("ミレニアル世代")\nelif year > 1994:\n    print("Z世代")\n',
      tests: [
        { name: '1994', inputs: ['1994'], check: 'assert "ミレニアル世代" in __out__, "1994年はミレニアル世代"' },
        { name: '1980', inputs: ['1980'], check: 'assert "ミレニアル世代" in __out__, "1980年もミレニアル世代"' },
        { name: '2000', inputs: ['2000'], check: 'assert "Z世代" in __out__, "2000年はZ世代"' }],
      hint: '境界の値（1980, 1994）が含まれていません。>= と <= を使いましょう。',
      solution: 'year = int(input("生まれ年: "))\nif year >= 1980 and year <= 1994:\n    print("ミレニアル世代")\nelif year >= 1995:\n    print("Z世代")\n' },
    { id: 'd13-3', title: 'バグ探し③：単語数カウント', prompt: '文章中の各単語の出現回数を数えるはずが、結果がおかしい。直そう。\n\n期待: `count_words("a b a c a")` → `{"a": 3, "b": 1, "c": 1}`',
      starter: 'def count_words(text):\n    counts = {}\n    for w in text.split():\n        counts = {}\n        if w in counts:\n            counts[w] += 1\n        else:\n            counts[w] = 1\n        return counts\n\nprint(count_words("a b a c a"))\n',
      tests: [{ name: 'a b a c a', check: 'r = count_words("a b a c a")\nassert r == {"a": 3, "b": 1, "c": 1}, f"結果: {r}"' }],
      hint: 'バグは2つ。ループの中で counts を毎回空にしている行と、return のインデント（ループの中にある）。',
      solution: 'def count_words(text):\n    counts = {}\n    for w in text.split():\n        if w in counts:\n            counts[w] += 1\n        else:\n            counts[w] = 1\n    return counts\n\nprint(count_words("a b a c a"))\n' },
  ],
},
{
  day: 14, title: '総合プロジェクト：どっちが高い？ゲーム', project: true,
  goal: 'データ（辞書のリスト）を扱い、関数で整理したゲームを作る',
  lesson: `### ゲームの流れ
1. データから2つの山（A と B）を選ぶ
2. 「どちらが高い？」と聞く
3. 正解ならスコア+1、B を次の A にして、新しい B を選んで続ける
4. 不正解ならゲーム終了、最終スコアを表示

### データ
\`\`\`python
data = [
    {"name": "富士山", "pref": "山梨・静岡", "height": 3776},
    {"name": "北岳", "pref": "山梨", "height": 3193},
    ...
]
\`\`\`
### 設計のポイント
- **表示用の文字列を作る関数**：\`format_item(item)\` → \`"富士山（山梨・静岡）"\`
- **判定の関数**：\`check_answer(guess, a_height, b_height)\` → True / False
- A と B が同じにならないようにする
\`\`\`python
b = random.choice(data)
while b == a:
    b = random.choice(data)
\`\`\`
> 関数にしておくと、テストもしやすく、後でデータを「都市の人口」などに入れ替えるのも簡単です。`,
  exercises: [
    { id: 'd14-1', title: '部品の関数', prompt: '`format_item(item)` と `check_answer(guess, a_height, b_height)` を作ろう。\n- format_item は `"富士山（山梨・静岡）"` の形の文字列を返す\n- check_answer は guess が `"a"` なら A が高いとき True、`"b"` なら B が高いとき True を返す',
      starter: 'def format_item(item):\n    pass\n\ndef check_answer(guess, a_height, b_height):\n    pass\n\nprint(format_item({"name": "富士山", "pref": "山梨・静岡", "height": 3776}))\n',
      tests: [
        { name: 'format_item', check: 'assert format_item({"name": "北岳", "pref": "山梨", "height": 3193}) == "北岳（山梨）", "形式は 名前（県）"' },
        { name: 'check_answer', check: 'assert check_answer("a", 3776, 3193) is True and check_answer("b", 3776, 3193) is False and check_answer("b", 3000, 3190) is True, "check_answer の判定が違います"' }],
      hint: 'return f"{item[\'name\']}（{item[\'pref\']}）"。check_answer は if a_height > b_height: return guess == "a" else: return guess == "b"。',
      solution: 'def format_item(item):\n    return f"{item[\'name\']}（{item[\'pref\']}）"\n\ndef check_answer(guess, a_height, b_height):\n    if a_height > b_height:\n        return guess == "a"\n    return guess == "b"\n\nprint(format_item({"name": "富士山", "pref": "山梨・静岡", "height": 3776}))\n' },
    { id: 'd14-2', title: 'ゲームを完成させる', prompt: '部品を使ってゲームを完成させよう。\n- 毎回 `A: 富士山（山梨・静岡）` `B: 北岳（山梨）` を表示し、`どっちが高い？(a/b) ` と聞く\n- 正解なら `正解！ スコア: 1` と表示して続行（B を次の A に）\n- 不正解なら `残念！ 最終スコア: 1` と表示して終了',
      starter: 'import random\n\ndata = [\n    {"name": "富士山", "pref": "山梨・静岡", "height": 3776},\n    {"name": "北岳", "pref": "山梨", "height": 3193},\n    {"name": "奥穂高岳", "pref": "長野・岐阜", "height": 3190},\n    {"name": "槍ヶ岳", "pref": "長野・岐阜", "height": 3180},\n    {"name": "御嶽山", "pref": "長野・岐阜", "height": 3067},\n    {"name": "立山", "pref": "富山", "height": 3015},\n    {"name": "白山", "pref": "石川・岐阜", "height": 2702},\n    {"name": "大雪山（旭岳）", "pref": "北海道", "height": 2291},\n    {"name": "石鎚山", "pref": "愛媛", "height": 1982},\n    {"name": "大山", "pref": "鳥取", "height": 1729},\n    {"name": "阿蘇山", "pref": "熊本", "height": 1592},\n    {"name": "高尾山", "pref": "東京", "height": 599},\n]\n\n# 部品の関数をここに貼ろう\n\n',
      tests: [
        { name: '不正解で終わる', inputs: ['a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a'], check: 'assert "最終スコア:" in __out__, "不正解になったら「残念！ 最終スコア: N」"\nassert "A: " in __out__ and "B: " in __out__, "A: と B: を表示しよう"' },
        { name: '正解を続けられる', inputs: ['b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b'], check: 'assert "最終スコア:" in __out__, "いずれ不正解になり終了するはず"' }],
      hint: 'score = 0; a = random.choice(data); while True: で b を選ぶ（a と違うもの）→ 表示 → 入力 → check_answer。正解なら score += 1 して a = b、不正解なら break。',
      solution: 'import random\n\ndata = [\n    {"name": "富士山", "pref": "山梨・静岡", "height": 3776},\n    {"name": "北岳", "pref": "山梨", "height": 3193},\n    {"name": "奥穂高岳", "pref": "長野・岐阜", "height": 3190},\n    {"name": "槍ヶ岳", "pref": "長野・岐阜", "height": 3180},\n    {"name": "御嶽山", "pref": "長野・岐阜", "height": 3067},\n    {"name": "立山", "pref": "富山", "height": 3015},\n    {"name": "白山", "pref": "石川・岐阜", "height": 2702},\n    {"name": "大雪山（旭岳）", "pref": "北海道", "height": 2291},\n    {"name": "石鎚山", "pref": "愛媛", "height": 1982},\n    {"name": "大山", "pref": "鳥取", "height": 1729},\n    {"name": "阿蘇山", "pref": "熊本", "height": 1592},\n    {"name": "高尾山", "pref": "東京", "height": 599},\n]\n\ndef format_item(item):\n    return f"{item[\'name\']}（{item[\'pref\']}）"\n\ndef check_answer(guess, a_height, b_height):\n    if a_height > b_height:\n        return guess == "a"\n    return guess == "b"\n\nscore = 0\na = random.choice(data)\nwhile True:\n    b = random.choice(data)\n    while b == a:\n        b = random.choice(data)\n    print(f"A: {format_item(a)}")\n    print(f"B: {format_item(b)}")\n    guess = input("どっちが高い？(a/b) ").lower()\n    if check_answer(guess, a["height"], b["height"]):\n        score += 1\n        print(f"正解！ スコア: {score}")\n        a = b\n    else:\n        print(f"残念！ 最終スコア: {score}")\n        break\n' },
  ],
},
{
  day: 15, title: '総合プロジェクト：自動販売機シミュレーター', project: true,
  goal: '辞書でデータを管理し、在庫・お金の計算を含む実用的なプログラムを作る',
  lesson: `### ローカルの開発環境について
本格的な開発ではPCに Python とエディタ（VS Code や PyCharm）を入れます。このアプリはブラウザの中で本物の Python（Pyodide）を動かしているので、スマホでもそのまま練習できます。PCを使うときは、ここで書いたコードを .py ファイルに保存して \`python main.py\` で実行できます。

### 自動販売機の仕様
- メニュー: 商品ごとに価格と必要な材料
- 在庫（材料）: 水・豆・ミルク
- 「report」と入力すると在庫と売上を表示
- 「off」で終了（メンテナンス用）
- 商品を選ぶ → 材料チェック → 硬貨を入れる → お釣り → 在庫を減らす

\`\`\`python
MENU = {
    "espresso": {"ingredients": {"water": 50, "coffee": 18}, "cost": 150},
    "latte": {"ingredients": {"water": 200, "coffee": 24, "milk": 150}, "cost": 250},
}
resources = {"water": 300, "milk": 200, "coffee": 100}
\`\`\`
### 硬貨の計算
\`\`\`python
total = n500 * 500 + n100 * 100 + n50 * 50 + n10 * 10
\`\`\`
> 「材料が足りるか」「お金が足りるか」「在庫を減らす」をそれぞれ関数にすると、メインのループがとても読みやすくなります。`,
  exercises: [
    { id: 'd15-1', title: '材料チェックと支払い', prompt: '2つの関数を作ろう。\n- `is_enough(order_ingredients, resources)` … 足りなければ `申し訳ありません、water が足りません` と表示して False、足りれば True\n- `process_coins(n500, n100, n50, n10)` … 合計金額を返す',
      starter: 'def is_enough(order_ingredients, resources):\n    pass\n\ndef process_coins(n500, n100, n50, n10):\n    pass\n',
      tests: [
        { name: '足りる', check: 'assert is_enough({"water": 50, "coffee": 18}, {"water": 300, "coffee": 100, "milk": 0}) is True, "足りるときは True"' },
        { name: '足りない', check: 'import io, sys\nbuf = io.StringIO(); old = sys.stdout; sys.stdout = buf\nr = is_enough({"water": 200, "milk": 150}, {"water": 300, "milk": 100})\nsys.stdout = old\nassert r is False, "足りないときは False"\nassert "申し訳ありません、milk が足りません" in buf.getvalue(), "「申し訳ありません、milk が足りません」と表示しよう"' },
        { name: '硬貨', check: 'assert process_coins(1, 2, 1, 3) == 780, "500×1 + 100×2 + 50×1 + 10×3 = 780"' }],
      hint: 'for item, amount in order_ingredients.items(): if amount > resources[item]: で表示して return False。ループを抜けたら return True。',
      solution: 'def is_enough(order_ingredients, resources):\n    for item, amount in order_ingredients.items():\n        if amount > resources[item]:\n            print(f"申し訳ありません、{item} が足りません")\n            return False\n    return True\n\ndef process_coins(n500, n100, n50, n10):\n    return n500 * 500 + n100 * 100 + n50 * 50 + n10 * 10\n' },
    { id: 'd15-2', title: '自販機を完成させる', prompt: '自販機を完成させよう。\n- `ご注文は？(espresso/latte/cappuccino) ` と聞く\n- `report` → `water: 300ml` `milk: 200ml` `coffee: 100g` `売上: 0円` を表示\n- `off` → 終了\n- 商品なら材料チェック → `500円玉は何枚？` `100円玉は何枚？` `50円玉は何枚？` `10円玉は何枚？` と聞き、\n  - 足りなければ `お金が足りません。返金します`\n  - 足りれば `お釣りは 100 円です` → 在庫を減らす → `latte をどうぞ ☕`',
      starter: 'MENU = {\n    "espresso": {"ingredients": {"water": 50, "coffee": 18}, "cost": 150},\n    "latte": {"ingredients": {"water": 200, "coffee": 24, "milk": 150}, "cost": 250},\n    "cappuccino": {"ingredients": {"water": 250, "coffee": 24, "milk": 100}, "cost": 300},\n}\nresources = {"water": 300, "milk": 200, "coffee": 100}\nprofit = 0\n\n# is_enough と process_coins をここに\n\n',
      tests: [
        { name: 'ラテを買って report', inputs: ['latte', '0', '3', '0', '0', 'report', 'off'], check: 'assert "お釣りは 50 円です" in __out__, "300円入れて250円のラテ → お釣り 50 円"\nassert "latte をどうぞ" in __out__, "「latte をどうぞ ☕」"\nassert "water: 100ml" in __out__ and "milk: 50ml" in __out__ and "coffee: 76g" in __out__ and "売上: 250円" in __out__, "report で在庫と売上を表示（water: 100ml / milk: 50ml / coffee: 76g / 売上: 250円）"' },
        { name: 'お金が足りない', inputs: ['cappuccino', '0', '1', '0', '0', 'off'], check: 'assert "お金が足りません。返金します" in __out__, "100円ではカプチーノは買えない"' },
        { name: '材料切れ', inputs: ['latte', '0', '3', '0', '0', 'latte', 'off'], check: 'assert "申し訳ありません、water が足りません" in __out__, "2杯目のラテは水が足りない"' }],
      hint: 'while True: で注文を聞き、off なら break、report なら表示、それ以外は MENU[choice] を取り出して is_enough → process_coins → 支払い判定 → resources[item] -= amount。profit は global にするか、メインのループ内で直接更新します。',
      solution: 'MENU = {\n    "espresso": {"ingredients": {"water": 50, "coffee": 18}, "cost": 150},\n    "latte": {"ingredients": {"water": 200, "coffee": 24, "milk": 150}, "cost": 250},\n    "cappuccino": {"ingredients": {"water": 250, "coffee": 24, "milk": 100}, "cost": 300},\n}\nresources = {"water": 300, "milk": 200, "coffee": 100}\nprofit = 0\n\ndef is_enough(order_ingredients, resources):\n    for item, amount in order_ingredients.items():\n        if amount > resources[item]:\n            print(f"申し訳ありません、{item} が足りません")\n            return False\n    return True\n\ndef process_coins(n500, n100, n50, n10):\n    return n500 * 500 + n100 * 100 + n50 * 50 + n10 * 10\n\nwhile True:\n    choice = input("ご注文は？(espresso/latte/cappuccino) ")\n    if choice == "off":\n        break\n    elif choice == "report":\n        print(f"water: {resources[\'water\']}ml")\n        print(f"milk: {resources[\'milk\']}ml")\n        print(f"coffee: {resources[\'coffee\']}g")\n        print(f"売上: {profit}円")\n    elif choice in MENU:\n        drink = MENU[choice]\n        if is_enough(drink["ingredients"], resources):\n            paid = process_coins(int(input("500円玉は何枚？")), int(input("100円玉は何枚？")), int(input("50円玉は何枚？")), int(input("10円玉は何枚？")))\n            if paid < drink["cost"]:\n                print("お金が足りません。返金します")\n            else:\n                print(f"お釣りは {paid - drink[\'cost\']} 円です")\n                profit += drink["cost"]\n                for item, amount in drink["ingredients"].items():\n                    resources[item] -= amount\n                print(f"{choice} をどうぞ ☕")\n' },
  ],
},
];
