// Pyodide（ブラウザで動く本物の Python）を Web Worker で実行する。
// Worker なので無限ループでもアプリが固まらない（メイン側でタイムアウト時に作り直す）。
const PYODIDE_VERSION = '0.27.2';
importScripts(`https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`);

const TURTLE_PY = String.raw`
import math as _m
_log = []
_turtles = []
_state = {'screen': None, 'default': None, 'mode': 1.0, 'size': (600, 600)}

def _reset():
    _log.clear(); _turtles.clear()
    _state.update({'screen': None, 'default': None, 'mode': 1.0, 'size': (600, 600)})

def _col(args):
    if len(args) == 1:
        a = args[0]
        if isinstance(a, str): return a
        args = tuple(a)
    if len(args) == 3:
        r, g, b = args
        if _state['mode'] == 1.0 and all(isinstance(v, float) or v <= 1 for v in (r, g, b)):
            r, g, b = r * 255, g * 255, b * 255
        return 'rgb(%d,%d,%d)' % (int(r), int(g), int(b))
    return 'black'

class Terminator(Exception): pass
class TurtleGraphicsError(Exception): pass
class Vec2D(tuple):
    def __new__(cls, x, y): return tuple.__new__(cls, (x, y))
    def __add__(self, o): return Vec2D(self[0] + o[0], self[1] + o[1])
    def __sub__(self, o): return Vec2D(self[0] - o[0], self[1] - o[1])
    def __abs__(self): return _m.hypot(*self)
    def __repr__(self): return '(%.2f,%.2f)' % self

class _Screen:
    def __init__(self): self._bg = 'white'
    def bgcolor(self, *a):
        if not a: return self._bg
        self._bg = _col(a); _log.append(('bg', self._bg))
    def setup(self, width=600, height=600, startx=None, starty=None):
        w = width if isinstance(width, int) and width > 1 else 600
        h = height if isinstance(height, int) and height > 1 else 600
        _state['size'] = (w, h); _log.append(('size', w, h))
    def screensize(self, w=None, h=None, bg=None):
        if bg: self.bgcolor(bg)
        return _state['size']
    def window_width(self): return _state['size'][0]
    def window_height(self): return _state['size'][1]
    def colormode(self, m=None):
        if m is None: return _state['mode']
        _state['mode'] = m
    def textinput(self, title, prompt): return input(prompt + ' ')
    def numinput(self, title, prompt, default=None, minval=None, maxval=None): return float(input(prompt + ' '))
    def turtles(self): return list(_turtles)
    def clear(self): _log.append(('clearall',))
    def register_shape(self, *a, **k): pass
    addshape = register_shape
    def _noop(self, *a, **k): pass
    title = tracer = update = listen = onkey = onkeypress = onkeyrelease = onclick = onscreenclick = ontimer = mainloop = done = exitonclick = bye = delay = mode = _noop

def Screen():
    if _state['screen'] is None: _state['screen'] = _Screen()
    return _state['screen']

class Turtle:
    def __init__(self, shape='classic', visible=True, **kw):
        Screen()
        self._id = len(_turtles); _turtles.append(self)
        self._x = 0.0; self._y = 0.0; self._h = 0.0
        self._down = True; self._pc = 'black'; self._fc = 'black'; self._w = 1
        self._vis = visible; self._shape = shape; self._fill = None; self._speed = 3
        self._snap()
    def _snap(self):
        _log.append(('t', self._id, self._x, self._y, self._h, self._vis, self._pc, self._fc, self._shape))
    def _moveto(self, x, y):
        if self._down: _log.append(('l', self._x, self._y, x, y, self._pc, self._w))
        self._x, self._y = float(x), float(y)
        if self._fill is not None: self._fill[1].append((self._x, self._y))
        self._snap()
    def forward(self, d):
        r = _m.radians(self._h)
        self._moveto(self._x + d * _m.cos(r), self._y + d * _m.sin(r))
    fd = forward
    def back(self, d): self.forward(-d)
    bk = backward = back
    def left(self, a): self._h = (self._h + a) % 360; self._snap()
    lt = left
    def right(self, a): self.left(-a)
    rt = right
    def goto(self, x, y=None):
        if y is None: x, y = x
        self._moveto(x, y)
    setpos = setposition = goto
    def setx(self, x): self._moveto(x, self._y)
    def sety(self, y): self._moveto(self._x, y)
    def setheading(self, a): self._h = a % 360; self._snap()
    seth = setheading
    def home(self): self._moveto(0, 0); self.setheading(0)
    def circle(self, radius, extent=None, steps=None):
        if extent is None: extent = 360
        frac = abs(extent) / 360
        if steps is None: steps = 1 + int(min(11 + abs(radius) / 6.0, 59.0) * frac)
        w = extent / steps; w2 = 0.5 * w
        l = 2.0 * radius * _m.sin(_m.radians(w2))
        if radius < 0: l, w, w2 = -l, -w, -w2
        self._h += w2
        for _ in range(steps):
            self.forward(l); self._h += w
        self._h -= w2; self._h %= 360; self._snap()
    def dot(self, size=None, *color):
        c = _col(color) if color else self._pc
        _log.append(('d', self._x, self._y, size or max(self._w + 4, self._w * 2), c))
    def penup(self): self._down = False
    pu = up = penup
    def pendown(self): self._down = True
    pd = down = pendown
    def isdown(self): return self._down
    def pensize(self, w=None):
        if w is None: return self._w
        self._w = w
    width = pensize
    def color(self, *a):
        if not a: return (self._pc, self._fc)
        if len(a) == 2 and all(isinstance(x, (str, tuple, list)) for x in a):
            self._pc = _col((a[0],)); self._fc = _col((a[1],))
        else:
            self._pc = self._fc = _col(a)
        self._snap()
    def pencolor(self, *a):
        if not a: return self._pc
        self._pc = _col(a); self._snap()
    def fillcolor(self, *a):
        if not a: return self._fc
        self._fc = _col(a); self._snap()
    def begin_fill(self): self._fill = (len(_log), [(self._x, self._y)])
    def end_fill(self):
        if self._fill and len(self._fill[1]) > 2:
            _log.insert(self._fill[0], ('f', self._fill[1], self._fc))
        self._fill = None
    def filling(self): return self._fill is not None
    def write(self, arg, move=False, align='left', font=('Arial', 8, 'normal')):
        _log.append(('w', self._x, self._y, str(arg), align, list(font), self._pc))
    def hideturtle(self): self._vis = False; self._snap()
    ht = hideturtle
    def showturtle(self): self._vis = True; self._snap()
    st = showturtle
    def isvisible(self): return self._vis
    def speed(self, s=None):
        if s is None: return self._speed
        self._speed = s
    def shape(self, s=None):
        if s is None: return self._shape
        self._shape = s; self._snap()
    def position(self): return Vec2D(self._x, self._y)
    pos = position
    def xcor(self): return self._x
    def ycor(self): return self._y
    def heading(self): return self._h
    def distance(self, x, y=None):
        if y is None:
            x, y = (x._x, x._y) if isinstance(x, Turtle) else x
        return _m.hypot(x - self._x, y - self._y)
    def towards(self, x, y=None):
        if y is None:
            x, y = (x._x, x._y) if isinstance(x, Turtle) else x
        return _m.degrees(_m.atan2(y - self._y, x - self._x)) % 360
    def clear(self): _log.append(('clear',))
    def reset(self): self.clear(); self._x = self._y = self._h = 0.0; self._snap()
    def stamp(self): _log.append(('s', self._x, self._y, self._h, self._fc, self._shape)); return 0
    def clone(self):
        t = Turtle(self._shape, self._vis)
        t._x, t._y, t._h, t._down, t._pc, t._fc, t._w = self._x, self._y, self._h, self._down, self._pc, self._fc, self._w
        t._snap(); return t
    def getscreen(self): return Screen()
    def _noop(self, *a, **k): pass
    shapesize = turtlesize = tilt = settiltangle = onclick = onrelease = ondrag = setundobuffer = undo = _noop

Pen = RawTurtle = Turtle

def _d():
    if _state['default'] is None: _state['default'] = Turtle()
    return _state['default']

def getturtle(): return _d()
def _mk(name):
    def f(*a, **k): return getattr(_d(), name)(*a, **k)
    f.__name__ = name
    return f
for _n in ['forward','fd','back','bk','backward','left','lt','right','rt','goto','setpos','setposition','setx','sety',
           'setheading','seth','home','circle','dot','penup','pu','up','pendown','pd','down','isdown','pensize','width',
           'color','pencolor','fillcolor','begin_fill','end_fill','filling','write','hideturtle','ht','showturtle','st',
           'isvisible','speed','shape','position','pos','xcor','ycor','heading','distance','towards','clear','reset',
           'stamp','shapesize','turtlesize','tilt','onclick']:
    globals()[_n] = _mk(_n)
def _sm(name):
    def f(*a, **k): return getattr(Screen(), name)(*a, **k)
    return f
for _n in ['bgcolor','setup','screensize','window_width','window_height','colormode','textinput','numinput','title',
           'tracer','update','listen','onkey','onkeypress','onscreenclick','ontimer','mainloop','done','exitonclick','bye','delay']:
    globals()[_n] = _sm(_n)
`;

const HARNESS_PY = String.raw`
import sys, io, builtins, random, traceback, base64

class _NeedInput(BaseException): pass
class _TooMuch(BaseException): pass

class _Out(io.StringIO):
    LIMIT = 200000
    def write(self, s):
        if self.tell() > self.LIMIT: raise _TooMuch()
        return super().write(s)

_images = []

_only_main = [True]
def _fmt_exc(e):
    if isinstance(e, SyntaxError):
        return ''.join(traceback.format_exception_only(type(e), e))
    te = traceback.TracebackException.from_exception(e)
    frames = [f for f in te.stack if f.filename == 'main.py' or (not _only_main[0] and f.filename.startswith('/home/pyodide/proj'))]
    te.stack = traceback.StackSummary.from_list(frames)
    return ''.join(te.format())

def _prep_mpl():
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    def _show(*a, **k):
        for num in plt.get_fignums():
            fig = plt.figure(num)
            buf = io.BytesIO()
            fig.savefig(buf, format='png', dpi=90, bbox_inches='tight')
            _images.append(base64.b64encode(buf.getvalue()).decode())
        plt.close('all')
    plt.show = _show

def _run_user(code, inputs, seed, filename='main.py'):
    out = _Out()
    it = iter(inputs)
    def fake_input(prompt=''):
        out.write(str(prompt))
        try:
            v = next(it)
        except StopIteration:
            raise _NeedInput(str(prompt))
        out.write(v + '\n')
        return v
    g = {'__name__': '__main__'}
    old = builtins.input, sys.stdout, sys.stderr
    builtins.input = fake_input
    sys.stdout = sys.stderr = out
    random.seed(seed)
    import turtle; turtle._reset()
    _images.clear()
    if 'matplotlib' in code:
        _prep_mpl()
    import linecache
    linecache.cache[filename] = (len(code), None, code.splitlines(True), filename)
    status, err = 'ok', ''
    try:
        exec(compile(code, filename, 'exec'), g)
        if 'matplotlib.pyplot' in sys.modules and _images == []:
            import matplotlib.pyplot as plt
            if plt.get_fignums(): plt.show()
    except _NeedInput:
        status = 'need_input'
    except _TooMuch:
        status, err = 'error', '出力が多すぎるため停止しました（無限ループで print していませんか？）'
    except SystemExit:
        pass
    except BaseException as e:
        status, err = 'error', _fmt_exc(e)
    finally:
        builtins.input, sys.stdout, sys.stderr = old
    return status, out.getvalue(), err, g

def _turtle_log():
    import turtle
    return list(turtle._log)

def run(code, inputs, seed):
    status, out, err, g = _run_user(code, list(inputs), seed)
    return {'status': status, 'out': out, 'err': err, 'turtle': _turtle_log(), 'images': list(_images)}

def run_tests(code, tests, seed):
    results = []
    for t in tests:
        status, out, err, g = _run_user(code, list(t.get('inputs') or []), seed)
        r = {'name': t.get('name', ''), 'pass': False, 'msg': '', 'out': out}
        if status == 'need_input':
            r['msg'] = 'input() が想定より多く呼ばれました（このテストで与えた入力: %s）' % (t.get('inputs') or 'なし')
        elif status == 'error':
            r['msg'] = err
        else:
            g['__out__'] = out
            g['__code_src__'] = code
            g['__lines__'] = [l for l in out.strip().split('\n')] if out.strip() else []
            g['__turtle__'] = _turtle_log()
            buf = _Out()
            old = sys.stdout
            sys.stdout = buf
            try:
                exec(t['check'], g)
                r['pass'] = True
            except AssertionError as e:
                r['msg'] = str(e) or 'テストに失敗しました'
            except BaseException as e:
                r['msg'] = _fmt_exc(e)
            finally:
                sys.stdout = old
        results.append(r)
    return {'tests': results}

_TEST_RUNNER = '''
import os, importlib.util, traceback
_found = []
for dp, dn, fn in os.walk('.'):
    for f in sorted(fn):
        if f.startswith('test_') and f.endswith('.py'):
            _found.append(os.path.join(dp, f)[2:])
_passed = _failed = 0
print('collected tests from', len(_found), 'file(s)')
for _path in sorted(_found):
    _spec = importlib.util.spec_from_file_location(_path[:-3].replace('/', '.'), _path)
    _mod = importlib.util.module_from_spec(_spec)
    try:
        _spec.loader.exec_module(_mod)
    except Exception as _e:
        print('ERROR', _path, '-', type(_e).__name__, _e)
        _failed += 1
        continue
    for _name in sorted(n for n in dir(_mod) if n.startswith('test_') and callable(getattr(_mod, n))):
        try:
            getattr(_mod, _name)()
            print(_path + '::' + _name, 'PASSED')
            _passed += 1
        except AssertionError as _e:
            _failed += 1
            _tb = traceback.extract_tb(_e.__traceback__)[-1]
            print(_path + '::' + _name, 'FAILED')
            print('    ' + str(_tb.filename).replace('/home/pyodide/proj/', '') + ':' + str(_tb.lineno) + ': ' + (_tb.line or ''))
            print('    AssertionError: ' + str(_e))
        except Exception as _e:
            _failed += 1
            print(_path + '::' + _name, 'FAILED')
            print('    ' + type(_e).__name__ + ': ' + str(_e))
print('=' * 10, str(_passed) + ' passed' + (', ' + str(_failed) + ' failed' if _failed else ''), '=' * 10)
'''

def run_project(files, mode, path, stdin):
    import os, shutil
    root = '/home/pyodide/proj'
    shutil.rmtree(root, ignore_errors=True)
    os.makedirs(root)
    for p, c in files.items():
        full = os.path.join(root, p)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, 'w') as f:
            f.write(c)
    for name, m in list(sys.modules.items()):
        if (getattr(m, '__file__', None) or '').startswith(root):
            del sys.modules[name]
    old = os.getcwd()
    os.chdir(root)
    sys.path.insert(0, root)
    _only_main[0] = False
    try:
        if mode == 'test':
            status, out, err, g = _run_user(_TEST_RUNNER, [], 1, '<pytest>')
        else:
            if path not in files:
                return {'status': 'error', 'out': '', 'err': 'ファイルがありません: ' + path}
            status, out, err, g = _run_user(files[path], stdin, 1, os.path.join(root, path))
        if status == 'need_input':
            err = 'EOFError: input() に与える stdin が足りません'
            status = 'error'
        return {'status': status, 'out': out, 'err': err.replace(root + '/', '')}
    finally:
        _only_main[0] = True
        os.chdir(old)
        sys.path.remove(root)
`;

let pyodide = null;
let harness = null;

async function init() {
  postMessage({ type: 'loading', msg: 'Python を読み込み中…（初回は数秒〜十数秒）' });
  pyodide = await loadPyodide();
  pyodide.FS.writeFile('/home/pyodide/turtle.py', TURTLE_PY);
  pyodide.runPython('import sys; sys.path.insert(0, "/home/pyodide")');
  harness = pyodide.runPython(HARNESS_PY + '\n(run, run_tests, run_project)');
  postMessage({ type: 'ready', version: pyodide.version });
}
const ready = init().catch(e => postMessage({ type: 'fatal', msg: String(e) }));

onmessage = async (e) => {
  await ready;
  const { id, type, code, inputs, seed, tests, files, mode, path, stdin } = e.data;
  try {
    // import pandas / numpy / matplotlib などを自動で読み込む
    if (type === 'project') {
      await pyodide.loadPackagesFromImports(Object.values(files).join('\n'), { messageCallback: () => {} });
      const r = harness.get(2)(pyodide.toPy(files), mode, path || '', pyodide.toPy(stdin || []));
      const o = r.toJs({ dict_converter: Object.fromEntries, create_proxies: false });
      r.destroy();
      postMessage({ id, type: 'result', ...o });
      return;
    }
    await pyodide.loadPackagesFromImports(code, { messageCallback: m => postMessage({ type: 'loading', msg: m }) });
    let res;
    if (type === 'run') {
      res = harness.get(0)(code, pyodide.toPy(inputs || []), seed || 0);
    } else {
      res = harness.get(1)(code, pyodide.toPy(tests), seed || 0);
    }
    const obj = res.toJs({ dict_converter: Object.fromEntries, create_proxies: false });
    res.destroy();
    postMessage({ id, type: 'result', ...obj });
  } catch (err) {
    postMessage({ id, type: 'result', status: 'error', out: '', err: String(err), tests: [] });
  }
};
