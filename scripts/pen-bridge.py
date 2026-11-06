#!/usr/bin/env python3
"""Pen bridge — streams a pen tablet's evdev events as JSON lines.

Spawned by app/api/pen/route.ts while a Hub sketch canvas has "Live pen" on. Two sources:

  local       (default) a USB tablet on this machine (e.g. Huion H420X). The device is
              exclusively grabbed (EVIOCGRAB): the OS never sees the pen while this runs;
              when it exits the kernel drops the grab and the pen is a normal pointer again.
  remarkable  a reMarkable Paper Pro over SSH (developer mode + key auth). NOT grabbed —
              the tablet's own notebook app keeps inking on paper while strokes mirror here.
              Host: $ALCHEMY_RM_HOST (default root@10.11.99.1, the USB-network address).

stdout protocol, one JSON object per line:
  {"type":"info","name":..,"path":..,"aspect":w/h}                 once, after grabbing
  {"type":"pen","x":0..1,"y":0..1,"p":0..1,"prox":bool,"down":bool,"eraser":bool,"b1":bool,"b2":bool}
  {"type":"error","code":"EACCES"|"NODEV"|..,"message":..}         then exit(1)

Device: $ALCHEMY_PEN_DEVICE (e.g. /dev/input/event8), else the first device reporting
BTN_TOOL_PEN + ABS_PRESSURE (on the tablet itself for `remarkable`). Stdlib only.
"""
import fcntl, json, os, re, struct, subprocess, sys

EV_SYN, EV_KEY, EV_ABS = 0, 1, 3
ABS_X, ABS_Y, ABS_PRESSURE = 0x00, 0x01, 0x18
BTN_TOOL_PEN, BTN_TOOL_RUBBER, BTN_TOUCH, BTN_STYLUS, BTN_STYLUS2 = 0x140, 0x141, 0x14A, 0x14B, 0x14C

EVIOCGRAB = 0x40044590                     # _IOW('E', 0x90, int)
def EVIOCGABS(axis): return 0x80184540 + axis  # _IOR('E', 0x40 + axis, struct input_absinfo)

EVENT = struct.Struct('llHHi')             # struct input_event on 64-bit: timeval, type, code, value


def emit(obj):
    sys.stdout.write(json.dumps(obj, separators=(',', ':')) + '\n')
    sys.stdout.flush()


def fail(code, message):
    emit({'type': 'error', 'code': code, 'message': message})
    sys.exit(1)


def has_bit(words_hex, bit):
    """/proc/bus/input/devices bitmaps: space-separated hex longs, most significant first."""
    words = [int(w, 16) for w in words_hex.split()][::-1]
    i, b = divmod(bit, 64)
    return i < len(words) and bool(words[i] >> b & 1)


def find_pen(devices_text):
    env = os.environ.get('ALCHEMY_PEN_DEVICE')
    if env:
        return env, os.path.basename(env)
    for block in devices_text.split('\n\n'):
        name = re.search(r'^N: Name="(.*)"', block, re.M)
        ev   = re.search(r'^H: Handlers=.*\b(event\d+)\b', block, re.M)
        key  = re.search(r'^B: KEY=(.*)$', block, re.M)
        abs_ = re.search(r'^B: ABS=(.*)$', block, re.M)
        if name and ev and key and abs_ and has_bit(key.group(1), BTN_TOOL_PEN) and has_bit(abs_.group(1), ABS_PRESSURE):
            return f'/dev/input/{ev.group(1)}', name.group(1)
    return None, None


def absinfo(fd, axis):
    # struct input_absinfo { s32 value, minimum, maximum, fuzz, flat, resolution; }
    buf = fcntl.ioctl(fd, EVIOCGABS(axis), bytes(24))
    _, lo, hi, _, _, res = struct.unpack('6i', buf)
    return lo, hi, res


def stream(read, ranges, name, path, grabbed, map_mode='fit', xform=None, aspect=None):
    """Decode input_event records from `read(n) -> bytes` and emit normalized pen samples.
    xform: optional (x, y) -> (x, y) on 0..1 sensor coords (calibration/orientation);
    aspect: override the reported width/height aspect of the (calibrated) area."""
    (x0, x1, xres), (y0, y1, yres), (p0, p1, _) = ranges
    # Physical aspect: units/mm may differ per axis; fall back to raw ranges if resolution is unreported
    w = (x1 - x0) / (xres or 1)
    h = (y1 - y0) / (yres or 1)
    emit({'type': 'info', 'name': name, 'path': path, 'aspect': aspect or (w / h if h else 1),
          'grabbed': grabbed, 'map': map_mode})

    st = {'x': 0, 'y': 0, 'p': 0, 'prox': False, 'down': False, 'eraser': False, 'b1': False, 'b2': False}
    last = None
    norm = lambda v, lo, hi: min(1.0, max(0.0, (v - lo) / (hi - lo))) if hi > lo else 0.0
    pending = b''

    while True:
        data = read(EVENT.size * 64)
        if not data:
            break
        data = pending + data
        usable = len(data) - len(data) % EVENT.size
        pending = data[usable:]
        for off in range(0, usable, EVENT.size):
            _, _, etype, code, value = EVENT.unpack_from(data, off)
            if etype == EV_ABS:
                if code == ABS_X:          st['x'] = norm(value, x0, x1)
                elif code == ABS_Y:        st['y'] = norm(value, y0, y1)
                elif code == ABS_PRESSURE: st['p'] = norm(value, p0, p1)
            elif etype == EV_KEY:
                on = value != 0
                if code == BTN_TOOL_PEN:      st['prox'] = on or st['eraser']
                elif code == BTN_TOOL_RUBBER: st['eraser'] = on; st['prox'] = on
                elif code == BTN_TOUCH:       st['down'] = on
                elif code == BTN_STYLUS:      st['b1'] = on
                elif code == BTN_STYLUS2:     st['b2'] = on
            elif etype == EV_SYN and code == 0:
                x, y = xform(st['x'], st['y']) if xform else (st['x'], st['y'])
                snap = (round(x, 5), round(y, 5), round(st['p'], 3), st['prox'], st['down'], st['eraser'], st['b1'], st['b2'])
                if snap != last:
                    last = snap
                    emit({'type': 'pen', 'x': snap[0], 'y': snap[1], 'p': snap[2], 'prox': st['prox'],
                          'down': st['down'], 'eraser': st['eraser'], 'b1': st['b1'], 'b2': st['b2']})


def run_local():
    with open('/proc/bus/input/devices') as f:
        path, name = find_pen(f.read())
    if not path:
        fail('NODEV', 'No pen tablet found (no device reports BTN_TOOL_PEN + ABS_PRESSURE). Is it plugged in?')
    try:
        fd = os.open(path, os.O_RDONLY)
    except PermissionError:
        fail('EACCES', f'No permission to read {path}. Install the udev rule: scripts/udev/70-alchemy-pen.rules')
    except FileNotFoundError:
        fail('NODEV', f'{path} does not exist — tablet unplugged?')

    try:
        fcntl.ioctl(fd, EVIOCGRAB, 1)
    except OSError as e:
        fail('EBUSY', f'Could not grab {path} (another program has it?): {e}')

    ranges = (absinfo(fd, ABS_X), absinfo(fd, ABS_Y), absinfo(fd, ABS_PRESSURE))
    stream(lambda n: os.read(fd, n), ranges, name, path, grabbed=True)


# ── reMarkable over SSH ───────────────────────────────────────────

SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', '-o', 'ServerAliveInterval=5']

# Paper Pro calibration: where the *visible screen* sits on the digitizer, as 0..1 of the raw
# ranges (x0, x1, y0, y1). The digitizer runs past the display — most on the left bezel.
# Measured by tracing the screen edge (2026-09-27). Override: ALCHEMY_RM_CALIB="x0,x1,y0,y1".
RM_CALIB  = (0.0765, 0.9823, 0.0340, 0.9747)
RM_ASPECT = 1620 / 2160   # display is 1620×2160 px portrait; digitizer units aren't square


def ssh(host, cmd, **kw):
    return subprocess.run(['ssh', *SSH_OPTS, host, cmd], capture_output=True, text=True, timeout=15, **kw)


def remote_absinfo(host, path):
    """No ioctl over SSH — read ranges from evtest's header (ships on the Paper Pro)."""
    out = ssh(host, f'(evtest {path} > /tmp/.alchemy-abs 2>&1 &); sleep 0.4; killall evtest 2>/dev/null; cat /tmp/.alchemy-abs; rm -f /tmp/.alchemy-abs').stdout
    ranges = {}
    for code, body in re.findall(r'Event code (\d+) \(ABS_\w+\)((?:\n\s+(?:Value|Min|Max|Fuzz|Flat|Resolution).*)+)', out):
        vals = dict(re.findall(r'(Min|Max|Resolution)\s+(-?\d+)', body))
        ranges[int(code)] = (int(vals.get('Min', 0)), int(vals.get('Max', 0)), int(vals.get('Resolution', 0)))
    if not all(k in ranges for k in (ABS_X, ABS_Y, ABS_PRESSURE)):
        fail('NOABS', f'Could not read pen ranges from {path} on the tablet (evtest output unrecognized).')
    return ranges[ABS_X], ranges[ABS_Y], ranges[ABS_PRESSURE]


def run_remarkable():
    host = os.environ.get('ALCHEMY_RM_HOST', 'root@10.11.99.1')
    try:
        probe = ssh(host, 'cat /proc/bus/input/devices')
    except subprocess.TimeoutExpired:
        fail('RMUNREACH', f'Timed out reaching the reMarkable at {host}. Is it plugged in and awake?')
    if probe.returncode != 0:
        err = probe.stderr.strip()
        if 'Permission denied' in err:
            fail('RMAUTH', f'SSH to {host} was refused — add your key: ssh-copy-id {host}')
        fail('RMUNREACH', f'Could not reach the reMarkable at {host}: {err or "ssh failed"}')

    path, name = find_pen(probe.stdout)
    if not path:
        fail('NODEV', 'No pen digitizer found on the reMarkable.')
    ranges = remote_absinfo(host, path)

    # Remote `cat` has no tty, so it wouldn't notice the SSH session ending until its next write.
    # Keep ssh's stdin open instead: when this process dies the pipe closes, `read` returns, and
    # the remote shell kills cat — no reader left behind on the tablet.
    proc = subprocess.Popen(['ssh', *SSH_OPTS, host, f'cat {path} & read _; kill $!'],
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    env = os.environ.get('ALCHEMY_RM_CALIB')
    cx0, cx1, cy0, cy1 = tuple(float(v) for v in env.split(',')) if env else RM_CALIB
    # Sensor → visible screen, 0..1 (can go slightly outside on the bezel; the canvas clamps)
    to_screen = lambda x, y: ((x - cx0) / (cx1 - cx0), (y - cy0) / (cy1 - cy0))
    try:
        stream(proc.stdout.read1, ranges, f'reMarkable · {name}', f'{host}:{path}', grabbed=False,
               map_mode='screen', xform=to_screen, aspect=RM_ASPECT)
    finally:
        proc.terminate()
    fail('RMCLOSED', 'Lost the SSH stream from the reMarkable (unplugged or asleep?)')


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else 'local'
    if source == 'remarkable':
        run_remarkable()
    else:
        run_local()


if __name__ == '__main__':
    import signal
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))  # run `finally` blocks (stop the ssh child) on kill
    try:
        main()
    except (BrokenPipeError, KeyboardInterrupt):
        pass
    except OSError as e:
        fail('IO', str(e))
