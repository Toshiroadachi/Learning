// Python 100日 カリキュラム（オリジナル教材）Day 16〜30
// __turtle__ にはタートルの描画ログが入る: ('l', x1, y1, x2, y2, 色, 太さ) など
export const DAYS_2 = [
{
  day: 16, title: 'オブジェクト指向（OOP）入門',
  goal: 'クラス・オブジェクト・属性・メソッドという考え方を理解し、既存のクラスを使う',
  lesson: `### なぜ OOP？
プログラムが大きくなると、関数と変数がバラバラに増えて管理しにくくなります。そこで「**データ（属性）**」と「**できること（メソッド）**」をひとまとめにした**オブジェクト**として考えます。

| 現実 | オブジェクト |
|---|---|
| 自動車の設計図 | **クラス**（Car） |
| 実際の1台 | **オブジェクト／インスタンス** |
| 色・速度 | **属性**（car.color） |
| 走る・止まる | **メソッド**（car.drive()） |

### 既存のクラスを使ってみる
Python の標準ライブラリにもたくさんのクラスがあります。
\`\`\`python
from datetime import date
d = date(2026, 12, 25)      # クラスからオブジェクトを作る
print(d.year, d.month)      # 属性
print(d.weekday())          # メソッド（0=月曜）
print(d.isoformat())        # "2026-12-25"
\`\`\`
\`\`\`python
from collections import Counter
c = Counter("banana")       # Counter クラスのオブジェクト
print(c.most_common(1))     # [('a', 3)]
\`\`\`
実は \`"abc".upper()\` や \`list.append()\` もメソッド。**str も list もクラス**なのです。
\`\`\`python
print(type("abc"))   # <class 'str'>
\`\`\`
> 公式ドキュメントを読んで、知らないクラスの使い方を調べる力も大切です。分からない属性は \`dir(オブジェクト)\` で一覧できます。`,
  exercises: [
    { id: 'd16-1', title: '誕生日まであと何日？', prompt: '`days_until(today, birthday_month, birthday_day)` を作ろう。today は `date` オブジェクト。今年の誕生日がもう過ぎていれば来年の誕生日までの日数を返す。\n\n`date` 同士を引き算すると `timedelta` オブジェクトになり、`.days` 属性で日数が取れます。',
      starter: 'from datetime import date\n\ndef days_until(today, birthday_month, birthday_day):\n    pass\n\nprint(days_until(date(2026, 11, 15), 12, 25))   # 40\n',
      tests: [
        { name: '今年', check: 'from datetime import date\nassert days_until(date(2026, 11, 15), 12, 25) == 40, "11/15 → 12/25 は 40日"' },
        { name: '過ぎていたら来年', check: 'from datetime import date\nassert days_until(date(2026, 11, 15), 3, 1) == 106, "11/15 → 翌年3/1 は 106日"' },
        { name: '当日', check: 'from datetime import date\nassert days_until(date(2026, 5, 5), 5, 5) == 0, "当日なら 0"' }],
      hint: 'b = date(today.year, birthday_month, birthday_day)。b < today なら date(today.year + 1, ...) にして、(b - today).days を返します。',
      solution: 'from datetime import date\n\ndef days_until(today, birthday_month, birthday_day):\n    b = date(today.year, birthday_month, birthday_day)\n    if b < today:\n        b = date(today.year + 1, birthday_month, birthday_day)\n    return (b - today).days\n\nprint(days_until(date(2026, 11, 15), 12, 25))\n' },
    { id: 'd16-2', title: 'いちばん多い文字', prompt: '`Counter` クラスを使って、文字列の中で最も多く出てくる文字とその回数を `"a: 3"` の形で返す `top_char(text)` を作ろう（空白は数えない）。',
      starter: 'from collections import Counter\n\ndef top_char(text):\n    pass\n\nprint(top_char("banana bread"))\n',
      tests: [{ name: 'banana', check: 'assert top_char("banana") == "a: 3", "banana は a が3回"\nassert top_char("a b b b") == "b: 3", "空白は数えない"' }],
      hint: 'c = Counter(text.replace(" ", ""))、ch, n = c.most_common(1)[0]',
      solution: 'from collections import Counter\n\ndef top_char(text):\n    c = Counter(text.replace(" ", ""))\n    ch, n = c.most_common(1)[0]\n    return f"{ch}: {n}"\n\nprint(top_char("banana bread"))\n' },
  ],
},
{
  day: 17, title: 'クラスを作る：クイズアプリ',
  goal: 'class・__init__・self・メソッドを自分で定義し、複数のクラスを組み合わせる',
  lesson: `### クラスの定義
\`\`\`python
class User:
    def __init__(self, user_id, name):   # 初期化（コンストラクタ）
        self.id = user_id                # 属性
        self.name = name
        self.followers = 0               # 初期値つきの属性

    def follow(self, other):             # メソッド（最初の引数は self）
        other.followers += 1

a = User("001", "たろう")
b = User("002", "はなこ")
a.follow(b)
print(b.followers)   # 1
\`\`\`
- クラス名は**パスカルケース**（単語の先頭を大文字: QuizBrain）
- \`self\` は「そのオブジェクト自身」。メソッドの中で属性にアクセスするときに使う
- \`__init__\` はオブジェクトを作るときに自動で呼ばれる

### クイズアプリの設計
- **Question** … 問題文と答えを持つ
- **QuizBrain** … 問題リスト・現在の番号・スコアを管理し、出題・採点する
\`\`\`python
class QuizBrain:
    def __init__(self, questions):
        self.number = 0
        self.score = 0
        self.questions = questions
    def still_has_questions(self):
        return self.number < len(self.questions)
\`\`\`
> 役割ごとにクラスを分けると、例えば問題データを API から取ってくるように変えても QuizBrain は変更不要になります。`,
  exercises: [
    { id: 'd17-1', title: 'Question と QuizBrain', prompt: 'クイズアプリを完成させよう。\n- `Question(text, answer)` … 属性 `text` と `answer`（"True"/"False"）\n- `QuizBrain(questions)` … `still_has_questions()`、`next_question()`、`check_answer(user, correct)`\n- next_question は `Q1. 問題文 (True/False): ` と input で聞き、check_answer を呼ぶ\n- check_answer は正解なら score を増やして `正解！`、不正解なら `不正解… 答えは False`、続けて `現在のスコア: 1/1`\n- 最後に `終了！ 最終スコア: 2/3`',
      starter: 'class Question:\n    pass\n\nclass QuizBrain:\n    pass\n\nquestion_data = [\n    {"text": "Python の名前の由来はヘビである", "answer": "False"},\n    {"text": "リストのインデックスは 0 から始まる", "answer": "True"},\n    {"text": "input() は数値を返す", "answer": "False"},\n]\n\nquestion_bank = []\n# question_data から Question オブジェクトを作って追加しよう\n\nquiz = QuizBrain(question_bank)\nwhile quiz.still_has_questions():\n    quiz.next_question()\nprint(f"終了！ 最終スコア: {quiz.score}/{quiz.number}")\n',
      tests: [
        { name: '2問正解', inputs: ['False', 'True', 'True'], check: 'assert "Q1. Python の名前の由来はヘビである (True/False):" in __out__, "Q1. 問題文 (True/False): の形で聞こう"\nassert "不正解… 答えは False" in __out__, "3問目は不正解"\nassert "現在のスコア: 1/1" in __out__, "1問ごとに「現在のスコア: 正解数/出題数」"\nassert "終了！ 最終スコア: 2/3" in __out__, "最終スコア 2/3"' },
        { name: 'クラスの形', inputs: ['True', 'True', 'True'], check: 'q = Question("x", "True")\nassert q.text == "x" and q.answer == "True", "Question に text と answer 属性"\nb = QuizBrain([q])\nassert b.number == 0 and b.score == 0 and b.still_has_questions(), "QuizBrain の初期状態"' },
        { name: '大文字小文字を区別しない', inputs: ['false', 'TRUE', 'false'], check: 'assert "終了！ 最終スコア: 3/3" in __out__, "user.lower() == correct.lower() で比較しよう"' }],
      hint: 'next_question では q = self.questions[self.number]; self.number += 1; ans = input(f"Q{self.number}. {q.text} (True/False): "); self.check_answer(ans, q.answer)。',
      solution: 'class Question:\n    def __init__(self, text, answer):\n        self.text = text\n        self.answer = answer\n\nclass QuizBrain:\n    def __init__(self, questions):\n        self.number = 0\n        self.score = 0\n        self.questions = questions\n\n    def still_has_questions(self):\n        return self.number < len(self.questions)\n\n    def next_question(self):\n        q = self.questions[self.number]\n        self.number += 1\n        ans = input(f"Q{self.number}. {q.text} (True/False): ")\n        self.check_answer(ans, q.answer)\n\n    def check_answer(self, user, correct):\n        if user.lower() == correct.lower():\n            self.score += 1\n            print("正解！")\n        else:\n            print(f"不正解… 答えは {correct}")\n        print(f"現在のスコア: {self.score}/{self.number}")\n\nquestion_data = [\n    {"text": "Python の名前の由来はヘビである", "answer": "False"},\n    {"text": "リストのインデックスは 0 から始まる", "answer": "True"},\n    {"text": "input() は数値を返す", "answer": "False"},\n]\n\nquestion_bank = []\nfor d in question_data:\n    question_bank.append(Question(d["text"], d["answer"]))\n\nquiz = QuizBrain(question_bank)\nwhile quiz.still_has_questions():\n    quiz.next_question()\nprint(f"終了！ 最終スコア: {quiz.score}/{quiz.number}")\n' },
  ],
},
{
  day: 18, title: 'タートルグラフィックス',
  goal: 'turtle モジュールで図形を描き、ドキュメントを読んで機能を使いこなす',
  lesson: `### タートルを動かす
\`\`\`python
from turtle import Turtle, Screen
t = Turtle()
t.shape("turtle")
t.color("tomato")
for _ in range(4):
    t.forward(100)   # 前へ100
    t.right(90)      # 右へ90度
screen = Screen()
screen.exitonclick()
\`\`\`
- \`forward/back\`, \`left/right\`, \`penup/pendown\`, \`goto(x, y)\`, \`setheading(角度)\`
- \`pensize(太さ)\`, \`color("red")\`, \`circle(半径)\`, \`dot(大きさ, 色)\`
- 座標は中心が (0, 0)、右が x+、上が y+

### import の書き方
\`\`\`python
import turtle            # turtle.Turtle()
from turtle import Turtle
import turtle as t       # 別名
\`\`\`
### タプル
\`(255, 0, 0)\` のように丸カッコで書く「変更できないリスト」。RGB の色などに使います。
\`\`\`python
screen.colormode(255)
t.pencolor((30, 144, 255))
\`\`\`
> このアプリでは描画結果が実行後にアニメーションで表示されます（キー操作など、リアルタイムの入力には対応していません）。`,
  exercises: [
    { id: 'd18-1', title: '正多角形を重ねて描く', prompt: '1辺 80 で、正三角形から正十角形まで（3〜10角形）を、同じ開始点から順に描こう。色は図形ごとに変えると綺麗です。\n\n正 n 角形は「forward → right(360 / n)」を n 回。',
      starter: 'from turtle import Turtle, Screen\nimport random\n\nt = Turtle()\ncolors = ["tomato", "orange", "gold", "seagreen", "deepskyblue", "royalblue", "mediumpurple", "hotpink"]\n\n',
      tests: [{ name: '3〜10角形', check: 'lines = [op for op in __turtle__ if op[0] == "l"]\nexp = sum(range(3, 11))\nassert len(lines) == exp, f"線の数が {len(lines)} 本。3〜10角形なら合計 {exp} 本のはず"\nimport math\nassert all(abs(math.hypot(op[3]-op[1], op[4]-op[2]) - 80) < 0.01 for op in lines), "1辺の長さは 80"' }],
      hint: 'for n in range(3, 11): の中で t.color(colors[n - 3]) とし、for _ in range(n): t.forward(80); t.right(360 / n)。',
      solution: 'from turtle import Turtle, Screen\nimport random\n\nt = Turtle()\ncolors = ["tomato", "orange", "gold", "seagreen", "deepskyblue", "royalblue", "mediumpurple", "hotpink"]\n\nfor n in range(3, 11):\n    t.color(colors[n - 3])\n    for _ in range(n):\n        t.forward(80)\n        t.right(360 / n)\n\nScreen().exitonclick()\n' },
    { id: 'd18-2', title: '点線', prompt: '長さ 10 の線と長さ 10 の空白を交互に 15 回くり返して、点線を描こう（penup / pendown を使う）。',
      starter: 'from turtle import Turtle\n\nt = Turtle()\nt.penup()\nt.goto(-150, 0)\nt.pendown()\n\n',
      tests: [{ name: '15本の線', check: 'lines = [op for op in __turtle__ if op[0] == "l"]\nassert len(lines) == 15, f"線が {len(lines)} 本（15本のはず）。goto で移動したときに線を引いていない？"\nassert all(abs(op[3]-op[1] - 10) < 0.01 for op in lines), "各線の長さは 10"' }],
      hint: 'for _ in range(15): t.forward(10); t.penup(); t.forward(10); t.pendown()',
      solution: 'from turtle import Turtle\n\nt = Turtle()\nt.penup()\nt.goto(-150, 0)\nt.pendown()\n\nfor _ in range(15):\n    t.forward(10)\n    t.penup()\n    t.forward(10)\n    t.pendown()\n' },
    { id: 'd18-3', title: 'スピログラフ', prompt: '半径 100 の円を、向きを 10 度ずつ変えながら 36 個描いてスピログラフを作ろう。色はランダムな RGB で。\n\n`colormode(255)` にして `(r, g, b)` のタプルを pencolor に渡します。',
      starter: 'from turtle import Turtle, Screen\nimport random\n\nscreen = Screen()\nscreen.colormode(255)\nt = Turtle()\n\ndef random_color():\n    return (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))\n\n',
      tests: [{ name: '36個の円', check: 'heads = sorted(set(round(op[4]) % 360 for op in __turtle__ if op[0] == "t"))\nlines = [op for op in __turtle__ if op[0] == "l"]\nassert len(lines) > 36 * 20, "円を36個描こう（circle(100) を36回）"\ncolors = set(op[5] for op in lines)\nassert len(colors) > 5, "色をランダムに変えよう"' }],
      hint: 'for _ in range(36): t.pencolor(random_color()); t.circle(100); t.setheading(t.heading() + 10)。t.speed("fastest") も付けておくと実際の PC で速く描けます。',
      solution: 'from turtle import Turtle, Screen\nimport random\n\nscreen = Screen()\nscreen.colormode(255)\nt = Turtle()\nt.speed("fastest")\n\ndef random_color():\n    return (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))\n\nfor _ in range(36):\n    t.pencolor(random_color())\n    t.circle(100)\n    t.setheading(t.heading() + 10)\n' },
  ],
},
{
  day: 19, title: 'インスタンス・状態・複数のオブジェクト',
  goal: '同じクラスから作った複数のオブジェクトが、それぞれ別の状態を持つことを理解する',
  lesson: `### 複数のインスタンス
\`\`\`python
from turtle import Turtle
a = Turtle()
b = Turtle()
a.color("red")      # a だけ赤
b.goto(0, 100)      # b だけ移動
\`\`\`
同じ設計図（クラス）から作っても、**状態（位置・色など）はオブジェクトごとに独立**しています。

### リストでまとめて管理
\`\`\`python
colors = ["red", "orange", "gold", "green", "blue", "purple"]
racers = []
for i, c in enumerate(colors):
    t = Turtle(shape="turtle")
    t.color(c)
    t.penup()
    t.goto(-230, -100 + i * 40)
    racers.append(t)
\`\`\`
### 関数を引数として渡す
\`\`\`python
def move_forward():
    t.forward(10)
screen.onkey(move_forward, "Up")    # 関数そのものを渡す（() を付けない）
\`\`\`
これは「イベントリスナー」と呼ばれ、キー操作に反応するゲームの基本です（このアプリではキー入力イベントは動かないので、PC で試してみましょう）。
> \`move_forward\` は関数そのもの、\`move_forward()\` は関数を**実行した結果**。この違いが「高階関数」の入口です。`,
  exercises: [
    { id: 'd19-1', title: 'タートルレース', prompt: '6匹のタートルをレースさせよう。\n- 色は `["red", "orange", "gold", "green", "blue", "purple"]`、スタートは x=-230、y は -100 から 40 ずつ\n- 毎ターン、全員が `random.randint(0, 10)` 進む\n- 誰かの x が 230 を超えたら終了し、`優勝は blue！` と表示\n- 予想を input で聞き（`どの色が勝つと思う？ `）、当たれば `的中！`、外れたら `残念…`',
      starter: 'from turtle import Turtle, Screen\nimport random\n\nscreen = Screen()\nscreen.setup(width=500, height=400)\ncolors = ["red", "orange", "gold", "green", "blue", "purple"]\nbet = input("どの色が勝つと思う？ ")\n\nracers = []\n\n',
      tests: [
        { name: 'レース', inputs: ['blue'], check: 'import re\nm = re.search(r"優勝は (\\w+)！", __out__)\nassert m and m.group(1) in ["red","orange","gold","green","blue","purple"], "「優勝は 色！」と表示しよう"\nassert ("的中！" in __out__) == (m.group(1) == "blue"), "予想と優勝が同じなら「的中！」"\nts = [op for op in __turtle__ if op[0] == "t"]\nassert len(set(op[1] for op in ts)) >= 6, "タートルを6匹作ろう"' }],
      hint: 'is_on = True; while is_on: for t in racers: t.forward(random.randint(0, 10)); if t.xcor() > 230: is_on = False; winner = t.pencolor() ... break',
      solution: 'from turtle import Turtle, Screen\nimport random\n\nscreen = Screen()\nscreen.setup(width=500, height=400)\ncolors = ["red", "orange", "gold", "green", "blue", "purple"]\nbet = input("どの色が勝つと思う？ ")\n\nracers = []\nfor i, c in enumerate(colors):\n    t = Turtle(shape="turtle")\n    t.color(c)\n    t.penup()\n    t.goto(-230, -100 + i * 40)\n    racers.append(t)\n\nwinner = None\nwhile winner is None:\n    for t in racers:\n        t.forward(random.randint(0, 10))\n        if t.xcor() > 230:\n            winner = t.pencolor()\n            break\n\nprint(f"優勝は {winner}！")\nprint("的中！" if winner == bet else "残念…")\n' },
  ],
},
{
  day: 20, title: '総合プロジェクト：ヘビゲーム（1）ヘビを作る', project: true,
  goal: 'ゲームのロジックをクラスにまとめる（体の管理・移動・方向転換）',
  lesson: `### ヘビゲームの分解
1. ヘビの体を作る（四角の連なり）
2. ヘビを動かす
3. 方向を変える（キー操作）
4. エサを食べたら伸びる・スコア（Day 21）
5. 壁や自分の体にぶつかったらゲームオーバー（Day 21）

### 体の動かし方のコツ
**後ろの節から順に、1つ前の節の位置へ移動**させ、最後に頭だけを進めます。
\`\`\`python
for i in range(len(segments) - 1, 0, -1):   # 後ろから
    segments[i] = segments[i - 1]
segments[0] = 新しい頭の位置
\`\`\`
### 逆向きには曲がれない
右に進んでいるとき、いきなり左には曲がれません（自分にぶつかるため）。

今回は画面描画とキー操作を切り離して、**座標だけで動くヘビ**をクラスで作ります。こうするとテストしやすく、後で turtle の見た目を付けるのも簡単です（実際のゲーム開発でもよく使う設計です）。
\`\`\`python
MOVE = 20
DIRS = {"up": (0, 1), "down": (0, -1), "left": (-1, 0), "right": (1, 0)}
\`\`\``,
  exercises: [
    { id: 'd20-1', title: 'Snake クラス', prompt: '`Snake` クラスを作ろう。\n- `segments` … 座標タプルのリスト。初期値 `[(0, 0), (-20, 0), (-40, 0)]`、`direction` は `"right"`\n- `move()` … 体を前の節の位置へずらし、頭を direction へ 20 進める\n- `turn(new_dir)` … 逆方向でなければ direction を変える\n- `head` プロパティでなく、`head()` メソッドで頭の座標を返す',
      starter: 'MOVE = 20\nDIRS = {"up": (0, 1), "down": (0, -1), "left": (-1, 0), "right": (1, 0)}\nOPPOSITE = {"up": "down", "down": "up", "left": "right", "right": "left"}\n\nclass Snake:\n    def __init__(self):\n        pass\n\n    def head(self):\n        pass\n\n    def move(self):\n        pass\n\n    def turn(self, new_dir):\n        pass\n\nsnake = Snake()\nsnake.move()\nsnake.turn("up")\nsnake.move()\nprint(snake.segments)\n',
      tests: [
        { name: '初期状態', check: 's = Snake()\nassert s.segments == [(0, 0), (-20, 0), (-40, 0)] and s.direction == "right", "初期の体と向き"' },
        { name: '移動', check: 's = Snake(); s.move()\nassert s.segments == [(20, 0), (0, 0), (-20, 0)], f"右に1マス: {s.segments}"\ns.turn("up"); s.move()\nassert s.segments == [(20, 20), (20, 0), (0, 0)], f"上に曲がって1マス: {s.segments}"\nassert s.head() == (20, 20)' },
        { name: '逆方向には曲がれない', check: 's = Snake(); s.turn("left"); s.move()\nassert s.direction == "right" and s.head() == (20, 0), "右向きのとき left は無視"' }],
      hint: 'move: for i in range(len(self.segments) - 1, 0, -1): self.segments[i] = self.segments[i - 1]。頭は dx, dy = DIRS[self.direction]; x, y = self.segments[0]; self.segments[0] = (x + dx * MOVE, y + dy * MOVE)',
      solution: 'MOVE = 20\nDIRS = {"up": (0, 1), "down": (0, -1), "left": (-1, 0), "right": (1, 0)}\nOPPOSITE = {"up": "down", "down": "up", "left": "right", "right": "left"}\n\nclass Snake:\n    def __init__(self):\n        self.segments = [(0, 0), (-20, 0), (-40, 0)]\n        self.direction = "right"\n\n    def head(self):\n        return self.segments[0]\n\n    def move(self):\n        for i in range(len(self.segments) - 1, 0, -1):\n            self.segments[i] = self.segments[i - 1]\n        dx, dy = DIRS[self.direction]\n        x, y = self.segments[0]\n        self.segments[0] = (x + dx * MOVE, y + dy * MOVE)\n\n    def turn(self, new_dir):\n        if new_dir != OPPOSITE[self.direction]:\n            self.direction = new_dir\n\nsnake = Snake()\nsnake.move()\nsnake.turn("up")\nsnake.move()\nprint(snake.segments)\n' },
    { id: 'd20-2', title: 'ヘビを描く', prompt: 'Snake を動かした結果を turtle で描こう。`draw(snake)` 関数で、各節の位置に `stamp()` で四角を押す（頭は別の色に）。\n\n操作列 `"RRUULLLD"`（R=右, U=上, L=左, D=下）の通りに turn → move し、最後に描画しよう。',
      starter: '# d20-1 の Snake クラスをここに貼ろう\n\nfrom turtle import Turtle, Screen\n\nscreen = Screen()\nscreen.bgcolor("black")\npen = Turtle(shape="square")\npen.penup()\npen.hideturtle()\n\ndef draw(snake):\n    pass\n\nsnake = Snake()\nkeys = {"R": "right", "U": "up", "L": "left", "D": "down"}\nfor k in "RRUULLLD":\n    pass\ndraw(snake)\n',
      tests: [{ name: '描画', check: 'stamps = [op for op in __turtle__ if op[0] == "s"]\nassert len(stamps) == 3, f"3つの節を stamp しよう（今 {len(stamps)} 個）"\npos = [(round(op[1]), round(op[2])) for op in stamps]\nassert (-20, 20) in pos, f"最終的な頭は (-20, 20) のはず: {pos}"' }],
      hint: 'draw: for i, (x, y) in enumerate(snake.segments): pen.goto(x, y); pen.color("lime" if i == 0 else "white"); pen.stamp()',
      solution: 'MOVE = 20\nDIRS = {"up": (0, 1), "down": (0, -1), "left": (-1, 0), "right": (1, 0)}\nOPPOSITE = {"up": "down", "down": "up", "left": "right", "right": "left"}\n\nclass Snake:\n    def __init__(self):\n        self.segments = [(0, 0), (-20, 0), (-40, 0)]\n        self.direction = "right"\n    def head(self):\n        return self.segments[0]\n    def move(self):\n        for i in range(len(self.segments) - 1, 0, -1):\n            self.segments[i] = self.segments[i - 1]\n        dx, dy = DIRS[self.direction]\n        x, y = self.segments[0]\n        self.segments[0] = (x + dx * MOVE, y + dy * MOVE)\n    def turn(self, new_dir):\n        if new_dir != OPPOSITE[self.direction]:\n            self.direction = new_dir\n\nfrom turtle import Turtle, Screen\n\nscreen = Screen()\nscreen.bgcolor("black")\npen = Turtle(shape="square")\npen.penup()\npen.hideturtle()\n\ndef draw(snake):\n    for i, (x, y) in enumerate(snake.segments):\n        pen.goto(x, y)\n        pen.color("lime" if i == 0 else "white")\n        pen.stamp()\n\nsnake = Snake()\nkeys = {"R": "right", "U": "up", "L": "left", "D": "down"}\nfor k in "RRUULLLD":\n    snake.turn(keys[k])\n    snake.move()\ndraw(snake)\n' },
  ],
},
{
  day: 21, title: 'ヘビゲーム（2）継承・スライス・当たり判定', project: true,
  goal: 'クラスの継承、リストのスライス、衝突判定でゲームを完成させる',
  lesson: `### 継承
既存のクラスの機能を引き継いで、新しいクラスを作れます。
\`\`\`python
class Animal:
    def __init__(self):
        self.eyes = 2
    def breathe(self):
        print("吸って、吐いて")

class Fish(Animal):            # Animal を継承
    def __init__(self):
        super().__init__()     # 親の __init__ を呼ぶ
    def breathe(self):         # 上書き（オーバーライド）
        super().breathe()
        print("水中で")
\`\`\`
ゲームでは \`class Food(Turtle):\` のように Turtle を継承して、「エサ」専用のタートルを作ったりします。

### スライス
\`\`\`python
nums = [0, 1, 2, 3, 4, 5]
nums[1:4]    # [1, 2, 3]
nums[:2]     # [0, 1]
nums[1:]     # [1, 2, 3, 4, 5]（頭以外！）
nums[::-1]   # 逆順
\`\`\`
### 当たり判定
- エサ: 頭とエサの距離が 15 未満なら食べた
- 壁: 頭の x や y が ±280 を超えたら
- 自分の体: 頭が \`segments[1:]\` のどれかと同じ位置なら`,
  exercises: [
    { id: 'd21-1', title: '伸びる・ぶつかる', prompt: 'Day 20 の Snake を**継承**した `GameSnake` を作ろう。\n- `extend()` … 最後の節と同じ位置に節を1つ追加（次の move で伸びる）\n- `hit_wall()` … 頭の x か y の絶対値が 280 を超えたら True\n- `hit_self()` … 頭が体（`segments[1:]`）に重なったら True',
      starter: 'MOVE = 20\nDIRS = {"up": (0, 1), "down": (0, -1), "left": (-1, 0), "right": (1, 0)}\nOPPOSITE = {"up": "down", "down": "up", "left": "right", "right": "left"}\n\nclass Snake:\n    def __init__(self):\n        self.segments = [(0, 0), (-20, 0), (-40, 0)]\n        self.direction = "right"\n    def head(self):\n        return self.segments[0]\n    def move(self):\n        for i in range(len(self.segments) - 1, 0, -1):\n            self.segments[i] = self.segments[i - 1]\n        dx, dy = DIRS[self.direction]\n        x, y = self.segments[0]\n        self.segments[0] = (x + dx * MOVE, y + dy * MOVE)\n    def turn(self, new_dir):\n        if new_dir != OPPOSITE[self.direction]:\n            self.direction = new_dir\n\nclass GameSnake(Snake):\n    pass\n',
      tests: [
        { name: '継承', check: 'assert issubclass(GameSnake, Snake), "class GameSnake(Snake): と書いて継承しよう"\ns = GameSnake(); assert len(s.segments) == 3' },
        { name: '伸びる', check: 's = GameSnake(); s.extend(); s.move()\nassert len(s.segments) == 4 and s.segments[-1] == (-40, 0), f"extend → move で4節に: {s.segments}"' },
        { name: '壁', check: 's = GameSnake()\nfor _ in range(14): s.move()\nassert not s.hit_wall(), "x=280 はまだセーフ"\ns.move(); assert s.hit_wall(), "x=300 は壁に衝突"' },
        { name: '自分の体', check: 's = GameSnake()\nfor _ in range(3): s.extend(); s.move()\nfor d in ["up", "left", "down"]: s.turn(d); s.move()\nassert s.hit_self(), f"ぐるっと回ると自分にぶつかる: {s.segments}"\nt = GameSnake(); t.move(); assert not t.hit_self()' }],
      hint: 'extend: self.segments.append(self.segments[-1])。hit_self: return self.head() in self.segments[1:]',
      solution: 'MOVE = 20\nDIRS = {"up": (0, 1), "down": (0, -1), "left": (-1, 0), "right": (1, 0)}\nOPPOSITE = {"up": "down", "down": "up", "left": "right", "right": "left"}\n\nclass Snake:\n    def __init__(self):\n        self.segments = [(0, 0), (-20, 0), (-40, 0)]\n        self.direction = "right"\n    def head(self):\n        return self.segments[0]\n    def move(self):\n        for i in range(len(self.segments) - 1, 0, -1):\n            self.segments[i] = self.segments[i - 1]\n        dx, dy = DIRS[self.direction]\n        x, y = self.segments[0]\n        self.segments[0] = (x + dx * MOVE, y + dy * MOVE)\n    def turn(self, new_dir):\n        if new_dir != OPPOSITE[self.direction]:\n            self.direction = new_dir\n\nclass GameSnake(Snake):\n    def extend(self):\n        self.segments.append(self.segments[-1])\n\n    def hit_wall(self):\n        x, y = self.head()\n        return abs(x) > 280 or abs(y) > 280\n\n    def hit_self(self):\n        return self.head() in self.segments[1:]\n' },
  ],
},
{
  day: 22, title: '総合プロジェクト：ポン（Pong）の物理', project: true,
  goal: 'ボールの速度・反射・パドルとの当たり判定をクラスで実装する',
  lesson: `### ボールの動き
ボールは毎フレーム \`x += dx\`、\`y += dy\` で動きます。
- 上下の壁に当たったら \`dy *= -1\`（縦方向だけ反転）
- パドルに当たったら \`dx *= -1\`（横方向だけ反転）、少し速くする
- 左右の端を越えたら相手の得点、ボールを中央に戻す

\`\`\`python
class Ball:
    def __init__(self):
        self.x, self.y = 0, 0
        self.dx, self.dy = 10, 10
    def move(self):
        self.x += self.dx
        self.y += self.dy
\`\`\`
### 当たり判定
パドルの中心 \`(px, py)\`、高さ 100 とすると、「ボールの x がパドルの x 付近」かつ「y の差が 50 以内」で当たり。
> 実際の PC 版では \`time.sleep(0.05)\` と \`screen.update()\` でアニメーションさせ、\`onkey\` でパドルを動かします。ここでは物理部分を作って、軌跡を描いて確認します。`,
  exercises: [
    { id: 'd22-1', title: 'Ball と Paddle', prompt: '`Ball` と `Paddle` を作ろう。\n- Ball: `move()`、`bounce_y()`（dy 反転）、`bounce_x()`（dx 反転して速さを 1.1 倍）、`reset()`（中央に戻し dx を反転、速さは初期値 10 に）\n- Paddle(x): 属性 `x`, `y`(初期 0)、`up()`/`down()` で y を ±20、`hits(ball)` … `abs(ball.x - self.x) < 20 and abs(ball.y - self.y) < 50`\n- 関数 `step(ball, left, right)` … ball.move() の後、`abs(y) > 280` なら bounce_y、どちらかのパドルに当たれば bounce_x、`x > 380` なら `"L"`、`x < -380` なら `"R"` を返して reset（得点した側）、それ以外は None',
      starter: 'class Ball:\n    def __init__(self):\n        self.x, self.y = 0, 0\n        self.dx, self.dy = 10, 10\n\nclass Paddle:\n    pass\n\ndef step(ball, left, right):\n    pass\n',
      tests: [
        { name: '移動と壁', check: 'b = Ball()\nfor _ in range(28): b.move()\nassert (b.x, b.y) == (280, 280)\nb.move(); b.bounce_y(); assert b.dy == -10, "bounce_y で dy が反転"' },
        { name: 'パドル', check: 'p = Paddle(350); p.up(); p.up()\nassert p.y == 40\nb = Ball(); b.x, b.y = 345, 10\nassert p.hits(b), "パドルの近くなら当たり"\nb.y = 120; assert not p.hits(b), "y が離れていれば外れ"' },
        { name: '反射で加速', check: 'b = Ball(); b.bounce_x()\nassert abs(b.dx + 11) < 1e-9, "dx が反転して1.1倍（-11）"' },
        { name: 'step で得点', check: 'b = Ball(); L = Paddle(-350); R = Paddle(350); R.y = 1000\nres = None\nfor _ in range(100):\n    res = step(b, L, R)\n    if res: break\nassert res == "L", "右のパドルが届かない位置なら左の得点"\nassert (b.x, b.y) == (0, 0) and b.dx == -10, "得点後は中央に戻り、逆向きに"' }],
      hint: 'reset では方向だけ残して速さを10に: self.dx = -10 if self.dx > 0 else 10、self.dy = 10。step は順番に if で判定。',
      solution: 'class Ball:\n    def __init__(self):\n        self.x, self.y = 0, 0\n        self.dx, self.dy = 10, 10\n    def move(self):\n        self.x += self.dx\n        self.y += self.dy\n    def bounce_y(self):\n        self.dy *= -1\n    def bounce_x(self):\n        self.dx *= -1.1\n    def reset(self):\n        self.x, self.y = 0, 0\n        self.dx = -10 if self.dx > 0 else 10\n        self.dy = 10\n\nclass Paddle:\n    def __init__(self, x):\n        self.x = x\n        self.y = 0\n    def up(self):\n        self.y += 20\n    def down(self):\n        self.y -= 20\n    def hits(self, ball):\n        return abs(ball.x - self.x) < 20 and abs(ball.y - self.y) < 50\n\ndef step(ball, left, right):\n    ball.move()\n    if abs(ball.y) > 280:\n        ball.bounce_y()\n    if left.hits(ball) or right.hits(ball):\n        ball.bounce_x()\n    if ball.x > 380:\n        ball.reset()\n        return "L"\n    if ball.x < -380:\n        ball.reset()\n        return "R"\n    return None\n' },
  ],
},
{
  day: 23, title: '総合プロジェクト：道路横断ゲーム', project: true,
  goal: 'たくさんのオブジェクトをリストで管理し、生成・移動・衝突判定・レベルアップを実装する',
  lesson: `### ゲームの仕様
- プレイヤーは下から上へ渡る。上端に着いたらレベルアップ（車が速くなる）してスタートに戻る
- 車はランダムに出現して左へ進む
- 車にぶつかったらゲームオーバー

### 設計
\`\`\`python
class Player:      # 位置、up()、at_finish()、go_start()
class CarManager:  # cars リスト、create_car()、move_cars()、level_up()
class Scoreboard:  # level、表示
\`\`\`
### ランダムな出現頻度
毎フレーム車を作ると多すぎるので、確率で間引きます。
\`\`\`python
if random.randint(1, 6) == 1:   # 6回に1回
    create_car()
\`\`\`
### 衝突判定（四角形どうし）
車の横幅 40・高さ 20、プレイヤーを点とすると:
\`\`\`python
abs(car_x - px) < 25 and abs(car_y - py) < 15
\`\`\`
> 画面外に出た車はリストから取り除くと、処理が重くなりません。\`[c for c in cars if c.x > -320]\` のような書き方（内包表記）は Day 26 で詳しく。`,
  exercises: [
    { id: 'd23-1', title: 'CarManager と Player', prompt: 'クラスを作ろう。\n- `Player`: `y` は -280 から、`up()` で +10、`at_finish()` は y > 280、`go_start()`\n- `Car(x, y)`: 属性 x, y\n- `CarManager`: `cars`（空リスト）、`speed`（5）、`add_car(x, y)`、`move_cars()` で全車の x を speed だけ減らし、x < -320 の車は削除、`level_up()` で speed += 10、`collides(player)` … 車と `abs(car.x - 0) < 25 and abs(car.y - player.y) < 15` なら True（プレイヤーの x は常に 0）',
      starter: 'class Player:\n    pass\n\nclass Car:\n    pass\n\nclass CarManager:\n    pass\n',
      tests: [
        { name: 'Player', check: 'p = Player()\nassert p.y == -280\nfor _ in range(57): p.up()\nassert p.y == 290 and p.at_finish()\np.go_start(); assert p.y == -280 and not p.at_finish()' },
        { name: '車の移動と削除', check: 'm = CarManager(); m.add_car(300, 0); m.add_car(-318, 50)\nm.move_cars()\nassert len(m.cars) == 1 and m.cars[0].x == 295, "移動後 x < -320 の車は削除"\nm.level_up(); assert m.speed == 15' },
        { name: '衝突', check: 'm = CarManager(); m.add_car(20, -270); p = Player()\nassert m.collides(p), "近くの車とぶつかる"\nm2 = CarManager(); m2.add_car(100, -280)\nassert not m2.collides(p), "離れていればセーフ"' }],
      hint: 'move_cars: for c in self.cars: c.x -= self.speed のあと self.cars = [c for c in self.cars if c.x >= -320]。collides は any(...) を使うと1行で書けます。',
      solution: 'class Player:\n    def __init__(self):\n        self.y = -280\n    def up(self):\n        self.y += 10\n    def at_finish(self):\n        return self.y > 280\n    def go_start(self):\n        self.y = -280\n\nclass Car:\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y\n\nclass CarManager:\n    def __init__(self):\n        self.cars = []\n        self.speed = 5\n    def add_car(self, x, y):\n        self.cars.append(Car(x, y))\n    def move_cars(self):\n        for c in self.cars:\n            c.x -= self.speed\n        self.cars = [c for c in self.cars if c.x >= -320]\n    def level_up(self):\n        self.speed += 10\n    def collides(self, player):\n        return any(abs(c.x) < 25 and abs(c.y - player.y) < 15 for c in self.cars)\n' },
  ],
},
{
  day: 24, title: 'ファイルの読み書きとパス',
  goal: 'open / with / read / write、ファイルパス、テンプレートから大量の文書を作る',
  lesson: `### ファイルを書く・読む
\`\`\`python
with open("memo.txt", "w") as f:      # w: 上書き / a: 追記
    f.write("こんにちは\\n")

with open("memo.txt") as f:           # 既定は r（読み込み）
    text = f.read()                    # 全部
# f.readlines() は行のリスト（改行つき）
\`\`\`
\`with\` を使うと、ブロックを抜けたとき自動でファイルが閉じられます。

### パス
- **絶対パス**: ルートからの場所（\`/home/user/data.txt\`）
- **相対パス**: 今いる場所からの場所（\`./data.txt\`、\`../other/data.txt\`）
\`\`\`python
import os
os.makedirs("output", exist_ok=True)
print(os.listdir("."))
\`\`\`
### 文字列の便利メソッド
\`.strip()\`（前後の空白・改行を除く）、\`.replace("[name]", "たろう")\`、\`.split("\\n")\`
> このアプリの Python はブラウザ内の仮想ファイルシステムで動いているので、ファイルを作っても端末には保存されません（練習には十分です）。`,
  exercises: [
    { id: 'd24-1', title: '招待状の差し込み印刷', prompt: 'テンプレートと名前リストのファイルが用意されています（コードの最初で作成）。\n- `names.txt` の各行の名前で、テンプレート中の `[name]` を置き換える\n- `output/たろう.txt` のように、名前ごとのファイルに保存する\n- 最後に作ったファイル数を `3件作成しました` と表示',
      starter: 'import os\n\n# --- 練習用のファイルを準備（ここは変更しない） ---\nwith open("template.txt", "w") as f:\n    f.write("[name] 様\\n\\n誕生日パーティーにご招待します！\\n12月25日 18時〜\\n")\nwith open("names.txt", "w") as f:\n    f.write("たろう\\nはなこ\\n じろう \\n")\n# -------------------------------------------\n\n',
      tests: [{ name: '3件', check: 'import os\nassert "3件作成しました" in __out__, "「3件作成しました」と表示しよう"\nfor n in ["たろう", "はなこ", "じろう"]:\n    p = os.path.join("output", n + ".txt")\n    assert os.path.exists(p), f"{p} がありません（名前の前後の空白は strip で除こう）"\n    assert open(p).read().startswith(n + " 様"), f"{p} の中身が「{n} 様」で始まっていません"' }],
      hint: 'template = open("template.txt").read()。for line in open("names.txt"): name = line.strip() で空白を除き、open(f"output/{name}.txt", "w") に template.replace("[name]", name) を書きます。os.makedirs("output", exist_ok=True) を忘れずに。',
      solution: 'import os\n\nwith open("template.txt", "w") as f:\n    f.write("[name] 様\\n\\n誕生日パーティーにご招待します！\\n12月25日 18時〜\\n")\nwith open("names.txt", "w") as f:\n    f.write("たろう\\nはなこ\\n じろう \\n")\n\nwith open("template.txt") as f:\n    template = f.read()\nos.makedirs("output", exist_ok=True)\ncount = 0\nwith open("names.txt") as f:\n    for line in f:\n        name = line.strip()\n        if not name:\n            continue\n        with open(f"output/{name}.txt", "w") as out:\n            out.write(template.replace("[name]", name))\n        count += 1\nprint(f"{count}件作成しました")\n' },
    { id: 'd24-2', title: 'ハイスコアの保存', prompt: '`save_high_score(score)` を作ろう。`high_score.txt` に保存されている最高点より高ければ上書きし、新しい最高点を返す（ファイルがなければ 0 とみなす）。',
      starter: 'import os\n\ndef save_high_score(score):\n    pass\n\nprint(save_high_score(50))\nprint(save_high_score(30))\nprint(save_high_score(80))\n',
      tests: [{ name: '更新', check: 'import os\nif os.path.exists("high_score.txt"): os.remove("high_score.txt")\nassert save_high_score(50) == 50 and save_high_score(30) == 50 and save_high_score(80) == 80, "最高点を返そう"\nassert open("high_score.txt").read().strip() == "80", "ファイルに最高点が保存されていること"' }],
      hint: 'os.path.exists で確認し、あれば int(f.read()) で読みます。score の方が大きければ "w" で str(score) を書き込みます。',
      solution: 'import os\n\ndef save_high_score(score):\n    best = 0\n    if os.path.exists("high_score.txt"):\n        with open("high_score.txt") as f:\n            best = int(f.read().strip() or 0)\n    if score > best:\n        best = score\n        with open("high_score.txt", "w") as f:\n            f.write(str(best))\n    return best\n\nprint(save_high_score(50))\nprint(save_high_score(30))\nprint(save_high_score(80))\n' },
  ],
},
{
  day: 25, title: 'CSV と pandas',
  goal: 'csv モジュールと pandas で表データを読み、集計・絞り込みをする',
  lesson: `### csv モジュール
\`\`\`python
import csv
with open("weather.csv") as f:
    for row in csv.DictReader(f):    # 1行ずつ辞書で
        print(row["day"], int(row["temp"]))
\`\`\`
### pandas
表データ分析の定番ライブラリ。**DataFrame**（表）と **Series**（列）が基本です。
\`\`\`python
import pandas as pd
df = pd.read_csv("weather.csv")
print(df["temp"].mean())        # 平均
print(df["temp"].max())
print(df[df["temp"] > 20])      # 条件で行を絞り込み
print(df[df["temp"] == df["temp"].max()])
row = df[df["day"] == "月"]
print(row["condition"].iloc[0])
\`\`\`
- \`df.head()\`、\`df.describe()\`、\`df["列"].value_counts()\`、\`df.groupby("列")["値"].mean()\`
- 辞書から作る: \`pd.DataFrame({"name": [...], "score": [...]})\`
- 保存: \`df.to_csv("out.csv", index=False)\`
> 初回の pandas 読み込みは少し時間がかかります（数MBのダウンロード）。`,
  exercises: [
    { id: 'd25-1', title: '気温データの分析', prompt: 'weather.csv を pandas で読み込み、次を表示しよう。\n- `平均気温: 19.3`（小数1桁）\n- `最高気温の日: 土`\n- `晴れの日数: 3`',
      starter: 'import pandas as pd\n\n# --- 練習用データ ---\nwith open("weather.csv", "w") as f:\n    f.write("day,temp,condition\\n月,18,晴れ\\n火,16,雨\\n水,19,くもり\\n木,21,晴れ\\n金,17,雨\\n土,24,晴れ\\n日,20,くもり\\n")\n# ------------------\n\n',
      tests: [{ name: '集計', check: 'assert "平均気温: 19.3" in __out__, "平均気温: 19.3（:.1f）"\nassert "最高気温の日: 土" in __out__, "最高気温の日: 土"\nassert "晴れの日数: 3" in __out__, "晴れの日数: 3"' }],
      hint: 'df = pd.read_csv("weather.csv")。df["temp"].mean()、df[df["temp"] == df["temp"].max()]["day"].iloc[0]、len(df[df["condition"] == "晴れ"])',
      solution: 'import pandas as pd\n\nwith open("weather.csv", "w") as f:\n    f.write("day,temp,condition\\n月,18,晴れ\\n火,16,雨\\n水,19,くもり\\n木,21,晴れ\\n金,17,雨\\n土,24,晴れ\\n日,20,くもり\\n")\n\ndf = pd.read_csv("weather.csv")\nprint(f"平均気温: {df[\'temp\'].mean():.1f}")\nhottest = df[df["temp"] == df["temp"].max()]\nprint(f"最高気温の日: {hottest[\'day\'].iloc[0]}")\nprint(f"晴れの日数: {len(df[df[\'condition\'] == \'晴れ\'])}")\n' },
    { id: 'd25-2', title: '集計して CSV に保存', prompt: '売上データを商品ごとに合計し、多い順に並べて `summary.csv`（列: `item,total`）に保存しよう。最後に 1 位を `1位: コーヒー 1350円` と表示。',
      starter: 'import pandas as pd\n\nsales = pd.DataFrame({\n    "item": ["コーヒー", "紅茶", "コーヒー", "ケーキ", "紅茶", "コーヒー", "ケーキ"],\n    "price": [450, 400, 450, 500, 400, 450, 500],\n})\n\n',
      tests: [{ name: '保存', check: 'import pandas as pd\nassert "1位: コーヒー 1350円" in __out__, "1位: コーヒー 1350円"\ns = pd.read_csv("summary.csv")\nassert list(s.columns) == ["item", "total"], f"列名は item,total にしよう: {list(s.columns)}"\nassert list(s["item"]) == ["コーヒー", "ケーキ", "紅茶"] and list(s["total"]) == [1350, 1000, 800], "多い順に並べよう"' }],
      hint: 'summary = sales.groupby("item")["price"].sum().sort_values(ascending=False).reset_index()、summary.columns = ["item", "total"]、summary.to_csv("summary.csv", index=False)',
      solution: 'import pandas as pd\n\nsales = pd.DataFrame({\n    "item": ["コーヒー", "紅茶", "コーヒー", "ケーキ", "紅茶", "コーヒー", "ケーキ"],\n    "price": [450, 400, 450, 500, 400, 450, 500],\n})\n\nsummary = sales.groupby("item")["price"].sum().sort_values(ascending=False).reset_index()\nsummary.columns = ["item", "total"]\nsummary.to_csv("summary.csv", index=False)\ntop = summary.iloc[0]\nprint(f"1位: {top[\'item\']} {top[\'total\']}円")\n' },
  ],
},
{
  day: 26, title: 'リスト内包表記・辞書内包表記',
  goal: 'for ループで作っていたリストや辞書を1行で作る',
  lesson: `### リスト内包表記
\`\`\`python
nums = [1, 2, 3, 4]
doubled = [n * 2 for n in nums]              # [2, 4, 6, 8]
evens = [n for n in nums if n % 2 == 0]      # 条件で絞り込み [2, 4]
names = ["Alex", "Beth", "Caroline"]
short = [x.upper() for x in names if len(x) < 5]
\`\`\`
### 辞書内包表記
\`\`\`python
import random
scores = {name: random.randint(1, 100) for name in names}
passed = {k: v for k, v in scores.items() if v >= 60}
\`\`\`
### pandas の行をループする
\`\`\`python
for index, row in df.iterrows():
    print(row["name"])
code = {row.letter: row.code for row in df.itertuples()}
\`\`\`
> 読みやすさが大事。条件が複雑になったら普通の for ループのほうが良いこともあります。`,
  exercises: [
    { id: 'd26-1', title: '内包表記ドリル', prompt: 'それぞれ**1行の内包表記**で書こう。\n1. `squares`: 1〜10 の二乗のリスト\n2. `long_words`: `words` のうち5文字以上の単語を大文字にしたリスト\n3. `word_len`: `words` の各単語 → 文字数 の辞書\n4. `common`: `a` と `b` の両方にある数のリスト（a の順番）',
      starter: 'words = ["apple", "fig", "banana", "kiwi", "cherry"]\na = [3, 6, 5, 8, 33, 12, 7]\nb = [8, 1, 3, 9, 12, 33]\n\nsquares = []\nlong_words = []\nword_len = {}\ncommon = []\n',
      tests: [{ name: '4問', check: 'assert squares == [n*n for n in range(1, 11)], "squares"\nassert long_words == ["APPLE", "BANANA", "CHERRY"], f"long_words: {long_words}"\nassert word_len == {"apple": 5, "fig": 3, "banana": 6, "kiwi": 4, "cherry": 6}, "word_len"\nassert common == [3, 8, 33, 12], f"common: {common}"' }],
      hint: '[n ** 2 for n in range(1, 11)]、[w.upper() for w in words if len(w) >= 5]、{w: len(w) for w in words}、[n for n in a if n in b]',
      solution: 'words = ["apple", "fig", "banana", "kiwi", "cherry"]\na = [3, 6, 5, 8, 33, 12, 7]\nb = [8, 1, 3, 9, 12, 33]\n\nsquares = [n ** 2 for n in range(1, 11)]\nlong_words = [w.upper() for w in words if len(w) >= 5]\nword_len = {w: len(w) for w in words}\ncommon = [n for n in a if n in b]\n' },
    { id: 'd26-2', title: 'モールス信号変換', prompt: '入力した英単語をモールス信号に変換しよう。辞書内包表記で `MORSE` 辞書（文字→符号）を `letters` と `codes` から作り、`HELLO` → `.... . .-.. .-.. ---` のように空白区切りで表示する。小文字の入力も大文字にして扱い、アルファベット以外が入っていたら `アルファベットだけを入力してください` と表示してもう一度聞く。',
      starter: 'letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"\ncodes = [".-", "-...", "-.-.", "-..", ".", "..-.", "--.", "....", "..", ".---", "-.-", ".-..", "--", "-.", "---", ".--.", "--.-", ".-.", "...", "-", "..-", "...-", ".--", "-..-", "-.--", "--.."]\n\nMORSE = {}\n',
      tests: [
        { name: 'hello', inputs: ['hello'], check: 'assert ".... . .-.. .-.. ---" in __out__, "HELLO → .... . .-.. .-.. ---"\nassert len(MORSE) == 26 and MORSE["S"] == "...", "MORSE 辞書を作ろう"' },
        { name: '不正な入力', inputs: ['sos!', 'sos'], check: 'assert "アルファベットだけを入力してください" in __out__ and "... --- ..." in __out__, "記号が入っていたら聞き直す"' }],
      hint: 'MORSE = {letters[i]: codes[i] for i in range(26)}（zip を使って {l: c for l, c in zip(letters, codes)} でも）。while True: で入力し、word.isalpha() でなければメッセージを出して continue。',
      solution: 'letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"\ncodes = [".-", "-...", "-.-.", "-..", ".", "..-.", "--.", "....", "..", ".---", "-.-", ".-..", "--", "-.", "---", ".--.", "--.-", ".-.", "...", "-", "..-", "...-", ".--", "-..-", "-.--", "--.."]\n\nMORSE = {l: c for l, c in zip(letters, codes)}\n\nwhile True:\n    word = input("英単語: ").upper()\n    if word.isalpha():\n        print(" ".join([MORSE[ch] for ch in word]))\n        break\n    print("アルファベットだけを入力してください")\n' },
  ],
},
{
  day: 27, title: '引数の応用：デフォルト値・*args・**kwargs',
  goal: '柔軟な関数を作るための引数の書き方を身につける',
  lesson: `### デフォルト引数
\`\`\`python
def make_tea(kind="緑茶", sugar=0):
    return f"{kind}（砂糖{sugar}）"
make_tea()                 # 緑茶（砂糖0）
make_tea(sugar=2)          # キーワードで一部だけ指定
\`\`\`
### *args（任意個の位置引数 → タプル）
\`\`\`python
def add(*args):
    return sum(args)
add(1, 2, 3, 4)    # 10
\`\`\`
### **kwargs（任意個のキーワード引数 → 辞書）
\`\`\`python
def profile(name, **kwargs):
    for key, value in kwargs.items():
        print(key, value)
    city = kwargs.get("city", "不明")   # 無ければデフォルト
profile("たろう", age=30, city="大阪")
\`\`\`
### アンパック
\`\`\`python
nums = [1, 2, 3]
add(*nums)                      # add(1, 2, 3) と同じ
opts = {"kind": "紅茶", "sugar": 1}
make_tea(**opts)
\`\`\`
> GUI ライブラリ（tkinter など）は \`Label(text="Hi", font=("Arial", 24))\` のようにキーワード引数を多用します。この仕組みを知っているとドキュメントが読みやすくなります。（tkinter はブラウザ版では動かないため、PC で試してみましょう）`,
  exercises: [
    { id: 'd27-1', title: '単位変換関数', prompt: '`convert(value, *, from_unit="km", to_unit="mile", digits=2)` を作ろう（* の後はキーワード専用引数）。\n- 対応単位: km, mile, m（1 mile = 1.609344 km、1 km = 1000 m）\n- 結果は digits 桁に丸めて返す\n\nさらに `total(*values, unit="km")` … 渡された値の合計を `"12.5 km"` の形で返す。',
      starter: 'TO_KM = {"km": 1, "mile": 1.609344, "m": 0.001}\n\ndef convert(value, *, from_unit="km", to_unit="mile", digits=2):\n    pass\n\ndef total(*values, unit="km"):\n    pass\n\nprint(convert(10))\n',
      tests: [
        { name: 'convert', check: 'assert convert(10) == 6.21, "10 km → 6.21 mile"\nassert convert(3, from_unit="mile", to_unit="m", digits=0) == 4828.0, "3 mile → 4828 m"\nassert convert(1500, from_unit="m", to_unit="km") == 1.5' },
        { name: 'キーワード専用', check: 'try:\n    convert(10, "km", "mile")\n    ok = False\nexcept TypeError:\n    ok = True\nassert ok, "* を付けて from_unit 以降をキーワード専用にしよう"' },
        { name: 'total', check: 'assert total(5, 7.5) == "12.5 km" and total(1, 2, 3, unit="mile") == "6 mile", f"total: {total(5, 7.5)}"' }],
      hint: 'km = value * TO_KM[from_unit]; return round(km / TO_KM[to_unit], digits)。total は f"{sum(values):g} {unit}"（:g で余分な .0 を消せます）。',
      solution: 'TO_KM = {"km": 1, "mile": 1.609344, "m": 0.001}\n\ndef convert(value, *, from_unit="km", to_unit="mile", digits=2):\n    km = value * TO_KM[from_unit]\n    return round(km / TO_KM[to_unit], digits)\n\ndef total(*values, unit="km"):\n    return f"{sum(values):g} {unit}"\n\nprint(convert(10))\n' },
  ],
},
{
  day: 28, title: '総合プロジェクト：ポモドーロ・プランナー', project: true,
  goal: '時間の計算（divmod・datetime）と状態の切り替えでタイマーのロジックを作る',
  lesson: `### ポモドーロ・テクニック
25分作業 → 5分休憩 を4回くり返したら、長い休憩（20分）。

### 秒を「分:秒」に
\`\`\`python
minutes, seconds = divmod(305, 60)   # (5, 5)
print(f"{minutes:02d}:{seconds:02d}")  # 05:05（02d で0埋め2桁）
\`\`\`
### datetime で時刻の計算
\`\`\`python
from datetime import datetime, timedelta
start = datetime(2026, 11, 15, 9, 0)
end = start + timedelta(minutes=25)
print(end.strftime("%H:%M"))   # 09:25
\`\`\`
### 状態（ステート）を持つ
「今は何回目の作業か」をカウンターで持ち、次が作業か休憩かを決めます。
\`\`\`python
reps += 1
if reps % 8 == 0: 長い休憩
elif reps % 2 == 0: 短い休憩
else: 作業
\`\`\`
> PC 版では tkinter の \`window.after(1000, 関数)\` で1秒ごとに画面を更新してカウントダウンを作ります。ロジックは同じです。`,
  exercises: [
    { id: 'd28-1', title: '時間フォーマット', prompt: '`fmt(seconds)` を作ろう。`"MM:SS"` 形式（0埋め2桁）で返す。60分以上でも分で表す（例: 3725 → `"62:05"`）。',
      starter: 'def fmt(seconds):\n    pass\n\nprint(fmt(305))\n',
      tests: [{ name: 'fmt', check: 'assert fmt(305) == "05:05" and fmt(0) == "00:00" and fmt(1500) == "25:00" and fmt(3725) == "62:05", "divmod と :02d を使おう"' }],
      hint: 'm, s = divmod(seconds, 60); return f"{m:02d}:{s:02d}"',
      solution: 'def fmt(seconds):\n    m, s = divmod(seconds, 60)\n    return f"{m:02d}:{s:02d}"\n\nprint(fmt(305))\n' },
    { id: 'd28-2', title: '1日のスケジュールを作る', prompt: '開始時刻（`9:00` 形式）とポモドーロの回数を入力し、スケジュールを表示しよう。作業25分、短い休憩5分、4回ごとに長い休憩20分（最後の作業の後には休憩を入れない）。\n\n表示例（9:00、2回）:\n```\n09:00-09:25 作業1\n09:25-09:30 休憩\n09:30-09:55 作業2\n終了 09:55\n```',
      starter: 'from datetime import datetime, timedelta\n\nWORK, SHORT, LONG = 25, 5, 20\n\n',
      tests: [
        { name: '2回', inputs: ['9:00', '2'], check: 'exp = ["09:00-09:25 作業1", "09:25-09:30 休憩", "09:30-09:55 作業2", "終了 09:55"]\nfor e in exp: assert e in __lines__, f"「{e}」の行がありません"' },
        { name: '5回（長い休憩あり）', inputs: ['13:30', '5'], check: 'assert "15:25-15:45 長い休憩" in __lines__, "4回目の作業の後は長い休憩（15:25-15:45）"\nassert "終了 16:10" in __lines__, "終了 16:10 になるはず"' }],
      hint: 't = datetime.strptime(input(...), "%H:%M")。for i in range(1, n + 1): で作業を表示し、i < n なら i % 4 == 0 で長い休憩、それ以外は休憩。時刻は t.strftime("%H:%M")。',
      solution: 'from datetime import datetime, timedelta\n\nWORK, SHORT, LONG = 25, 5, 20\n\nt = datetime.strptime(input("開始時刻: "), "%H:%M")\nn = int(input("回数: "))\nfor i in range(1, n + 1):\n    end = t + timedelta(minutes=WORK)\n    print(f"{t:%H:%M}-{end:%H:%M} 作業{i}")\n    t = end\n    if i < n:\n        if i % 4 == 0:\n            end = t + timedelta(minutes=LONG)\n            print(f"{t:%H:%M}-{end:%H:%M} 長い休憩")\n        else:\n            end = t + timedelta(minutes=SHORT)\n            print(f"{t:%H:%M}-{end:%H:%M} 休憩")\n        t = end\nprint(f"終了 {t:%H:%M}")\n' },
  ],
},
{
  day: 29, title: '例外処理：try / except / else / finally',
  goal: 'エラーが起きてもプログラムを止めずに対処する。raise で自分から例外を出す',
  lesson: `### try / except
\`\`\`python
try:
    n = int(input("数: "))
except ValueError:
    print("数字を入力してください")
else:
    print("OK:", n)          # 例外が起きなかったとき
finally:
    print("終わり")           # 必ず実行
\`\`\`
- except は**起きうる種類を指定**する（何でも捕まえる \`except:\` はバグを隠すので避ける）
- \`except (KeyError, IndexError) as e:\` で複数・内容の取得

### raise で例外を起こす
\`\`\`python
def set_age(age):
    if age < 0:
        raise ValueError("年齢は0以上")
\`\`\`
### よく使う場面
- ファイルが無い → \`FileNotFoundError\`
- 辞書にキーが無い → \`KeyError\`
- 数値に変換できない → \`ValueError\`
> 「起きることが分かっていて、対処方法も決まっている」エラーだけを捕まえます。想定外のエラーはそのまま表示されたほうが、原因を見つけやすいです。`,
  exercises: [
    { id: 'd29-1', title: '安全な入力', prompt: '`ask_int(prompt, low, high)` を作ろう。数字以外なら `数字で入力してください`、範囲外なら `1〜10 の範囲で入力してください` と表示して聞き直し、正しい整数を返す。\n\nメインで `ask_int("1〜10: ", 1, 10)` の結果を使って `あなたの数は 7` と表示。',
      starter: 'def ask_int(prompt, low, high):\n    pass\n\nn = ask_int("1〜10: ", 1, 10)\nprint(f"あなたの数は {n}")\n',
      tests: [{ name: '聞き直し', inputs: ['abc', '15', '7'], check: 'assert "数字で入力してください" in __out__, "abc には「数字で入力してください」"\nassert "1〜10 の範囲で入力してください" in __out__, "15 には範囲外のメッセージ"\nassert "あなたの数は 7" in __out__' }],
      hint: 'while True: try: n = int(input(prompt)) except ValueError: print(...); continue。範囲チェックして OK なら return n。',
      solution: 'def ask_int(prompt, low, high):\n    while True:\n        try:\n            n = int(input(prompt))\n        except ValueError:\n            print("数字で入力してください")\n            continue\n        if low <= n <= high:\n            return n\n        print(f"{low}〜{high} の範囲で入力してください")\n\nn = ask_int("1〜10: ", 1, 10)\nprint(f"あなたの数は {n}")\n' },
    { id: 'd29-2', title: 'いいね数の集計', prompt: 'SNS の投稿データには "likes" が無いものがあります。KeyError を例外処理して、likes が無い投稿は 0 として合計を返す `total_likes(posts)` を作ろう（`.get()` は使わずに try/except で）。\n\nまた、likes が負の数なら `ValueError("likes が負です")` を raise すること。',
      starter: 'def total_likes(posts):\n    pass\n\nposts = [{"likes": 21}, {"comments": 2}, {"likes": 13, "comments": 2}, {"likes": 33}]\nprint(total_likes(posts))\n',
      tests: [
        { name: '合計', check: 'assert total_likes([{"likes": 21}, {"comments": 2}, {"likes": 13}]) == 34, "likes が無い投稿は 0"' },
        { name: 'raise', check: 'try:\n    total_likes([{"likes": -1}])\n    ok = False\nexcept ValueError as e:\n    ok = "負" in str(e)\nassert ok, "負の値で ValueError(\\"likes が負です\\") を raise しよう"' },
        { name: 'try を使う', check: 'assert "try" in __code_src__ and "KeyError" in __code_src__ and ".get(" not in __code_src__, "try/except KeyError で書いてみよう"' }],
      hint: 'for p in posts: try: n = p["likes"] except KeyError: n = 0。if n < 0: raise ValueError("likes が負です")',
      solution: 'def total_likes(posts):\n    total = 0\n    for p in posts:\n        try:\n            n = p["likes"]\n        except KeyError:\n            n = 0\n        if n < 0:\n            raise ValueError("likes が負です")\n        total += n\n    return total\n\nposts = [{"likes": 21}, {"comments": 2}, {"likes": 13, "comments": 2}, {"likes": 33}]\nprint(total_likes(posts))\n' },
  ],
},
{
  day: 30, title: 'JSON でデータを保存：パスワード管理ツール', project: true,
  goal: 'json モジュールで辞書を保存・読み込み・更新し、例外処理と組み合わせる',
  lesson: `### JSON
辞書やリストを文字列（テキストファイル）として保存できる形式。Web API でも使われます。
\`\`\`python
import json
data = {"gmail": {"email": "me@example.com", "password": "abc123"}}
with open("data.json", "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)   # 書く
with open("data.json") as f:
    loaded = json.load(f)                             # 読む
\`\`\`
- \`json.dumps(obj)\` / \`json.loads(text)\` は文字列との変換
- 更新は「読む → 辞書を update → 書く」

### 例外処理と組み合わせる
\`\`\`python
try:
    with open("data.json") as f:
        data = json.load(f)
except FileNotFoundError:
    data = {}
\`\`\`
### パスワード生成
\`\`\`python
import random, string
chars = string.ascii_letters + string.digits + "!#$%&"
pw = "".join(random.choice(chars) for _ in range(12))
\`\`\`
> 本物のパスワード管理には暗号化が必須です。これは JSON の練習用です。`,
  exercises: [
    { id: 'd30-1', title: '保存と検索', prompt: '`save(site, email, password)` と `find(site)` を作ろう（ファイルは `vault.json`）。\n- save: 既存の内容を読み込み（無ければ空）、site をキーに `{"email": ..., "password": ...}` を追加・上書きして保存\n- find: 見つかれば `"email: me@example.com / password: abc123"` を返す。サイトが無ければ `"gmail は登録されていません"`、ファイルが無ければ `"データがありません"`',
      starter: 'import json\nimport os\n\nFILE = "vault.json"\n\ndef save(site, email, password):\n    pass\n\ndef find(site):\n    pass\n',
      tests: [
        { name: 'ファイルなし', check: 'import os\nif os.path.exists("vault.json"): os.remove("vault.json")\nassert find("gmail") == "データがありません", "ファイルが無いとき（FileNotFoundError）"' },
        { name: '保存と検索', check: 'import os, json\nif os.path.exists("vault.json"): os.remove("vault.json")\nsave("gmail", "me@example.com", "abc123")\nsave("github", "dev@example.com", "x9!")\nassert find("gmail") == "email: me@example.com / password: abc123"\nassert find("amazon") == "amazon は登録されていません"\nd = json.load(open("vault.json"))\nassert set(d) == {"gmail", "github"}, "2件とも保存されていること（上書きで消えていない？）"' },
        { name: '上書き', check: 'import os\nif os.path.exists("vault.json"): os.remove("vault.json")\nsave("gmail", "a@a", "1"); save("gmail", "b@b", "2")\nassert find("gmail") == "email: b@b / password: 2"' }],
      hint: 'save: try: with open(FILE) as f: data = json.load(f) except FileNotFoundError: data = {}。data[site] = {...} の後 "w" で json.dump。find も同様に try で読み、KeyError / FileNotFoundError を処理。',
      solution: 'import json\nimport os\n\nFILE = "vault.json"\n\ndef save(site, email, password):\n    try:\n        with open(FILE) as f:\n            data = json.load(f)\n    except FileNotFoundError:\n        data = {}\n    data[site] = {"email": email, "password": password}\n    with open(FILE, "w") as f:\n        json.dump(data, f, indent=2, ensure_ascii=False)\n\ndef find(site):\n    try:\n        with open(FILE) as f:\n            data = json.load(f)\n    except FileNotFoundError:\n        return "データがありません"\n    try:\n        entry = data[site]\n    except KeyError:\n        return f"{site} は登録されていません"\n    return f"email: {entry[\'email\']} / password: {entry[\'password\']}"\n' },
  ],
},
];
