import { useEffect, useRef } from "react";

export type ShaderVariant = "smoke" | "neuro-noise" | "halftone" | "silk";

export type ShaderBackgroundProps = {
  /** Up to 8 colors, low → high, as [r,g,b] 0..1 tuples. */
  colors: [number, number, number][];
  variant?: ShaderVariant;
  seed?: number;
  className?: string;
};

const VERT = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Shared prelude + post-processing. All three shaders come from the 21st.dev
// Shader Builder packed-uniform format (15 fragment uniform vectors).
const COMMON_HEAD = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec3 u_colors[8];
uniform vec4 u_scene;      // resolution.xy, time, colour count
uniform vec4 u_shape;      // scale, intensity, paramA, warp
uniform vec4 u_surface;    // detail, contrast, brightness, saturation
uniform vec4 u_finish;     // hue, vignette, blur, grain
uniform vec4 u_transform;  // seed, rotation, drift, OKLab toggle
uniform vec4 u_space;      // offset.xy, pointer.xy
uniform vec4 u_cursor;

#define u_resolution u_scene.xy
#define u_time u_scene.z
#define u_colorCount u_scene.w
#define u_scale u_shape.x
#define u_intensity u_shape.y
#define u_paramA u_shape.z
#define u_warp u_shape.w
#define u_detail u_surface.x
#define u_contrast u_surface.y
#define u_brightness u_surface.z
#define u_saturation u_surface.w
#define u_hue u_finish.x
#define u_vignette u_finish.y
#define u_blur u_finish.z
#define u_grain u_finish.w
#ifdef GL_FRAGMENT_PRECISION_HIGH
#define u_seed u_transform.x
#else
#define u_seed mod(u_transform.x, 31.0)
#endif
#define u_rotate u_transform.y
#define u_drift u_transform.z
#define u_oklab u_transform.w
#define u_offset u_space.xy
#define u_mouse u_space.zw
#define u_cursorPresence u_cursor.x
#define u_cursorEffect u_cursor.y
#define u_cursorStrength u_cursor.z
#define u_cursorRadius u_cursor.w

float hash21(vec2 p) {
#ifndef GL_FRAGMENT_PRECISION_HIGH
  p = mod(p, 31.0);
#endif
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
#ifndef GL_FRAGMENT_PRECISION_HIGH
  p = mod(p, 31.0);
#endif
  float n = sin(dot(p, vec2(41.0, 289.0)));
  return fract(vec2(15731.743, 7892.321) * n);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.2);
    a *= 0.5;
  }
  return v;
}

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)),
    step(0.04045, c));
}

vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, c));
}

vec3 linToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(max(l, 0.0), 1.0 / 3.0);
  m = pow(max(m, 0.0), 1.0 / 3.0);
  s = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}

vec3 oklabToLin(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}

vec3 mixColour(vec3 a, vec3 b, float t) {
  if (u_oklab > 0.5) {
    vec3 la = linToOklab(srgbToLinear(a));
    vec3 lb = linToOklab(srgbToLinear(b));
    return clamp(linearToSrgb(oklabToLin(mix(la, lb, t))), 0.0, 1.0);
  }
  return mix(a, b, t);
}

vec3 palette(float x) {
  float n = max(u_colorCount - 1.0, 1.0);
  float f = clamp(x, 0.0, 1.0) * n;
  vec3 col = u_colors[0];
  for (int i = 0; i < 7; i++) {
    if (float(i) < n)
      col = mixColour(col, u_colors[i + 1],
        smoothstep(0.0, 1.0, clamp(f - float(i), 0.0, 1.0)));
  }
  return col;
}

vec3 hueRotate(vec3 col, float a) {
  const mat3 toYIQ = mat3(0.299, 0.596, 0.211,
                          0.587, -0.274, -0.523,
                          0.114, -0.322, 0.312);
  const mat3 toRGB = mat3(1.0, 1.0, 1.0,
                          0.956, -0.272, -1.106,
                          0.621, -0.647, 1.703);
  vec3 yiq = toYIQ * col;
  float ca = cos(a), sa = sin(a);
  yiq = vec3(yiq.x, yiq.y * ca - yiq.z * sa, yiq.y * sa + yiq.z * ca);
  return toRGB * yiq;
}
`;

// "Smoke" — 21st.dev flow shader.
const SHADE_SMOKE = `
vec3 shade(vec2 uv, vec2 p, float t) {
  float warp = 2.0 + u_intensity * 4.0;
  vec2 q = vec2(fbm(p + t * 0.08), fbm(p + vec2(5.2, 1.3) - t * 0.06));
  vec2 r = vec2(fbm(p + warp * q + vec2(1.7, 9.2)),
                fbm(p + warp * q + vec2(8.3, 2.8)));
  return palette(fbm(p + 3.0 * r + u_seed));
}
`;

// "Neuro Noise" — adapted from Paper Shaders (Apache-2.0).
const SHADE_NEURO = `
vec3 shade(vec2 uv, vec2 p, float t) {
  vec2 q = p * (1.6 + u_intensity * 2.4);
  float field = 0.0;
  float weight = 0.55;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    q += vec2(
      sin(q.y * (1.7 + fi * 0.09) + t * (0.35 + fi * 0.04) + u_seed),
      cos(q.x * (1.5 + fi * 0.11) - t * (0.28 + fi * 0.03))
    ) * (0.22 + u_intensity * 0.14);
    float filaments = abs(sin(q.x + q.y + fi * 0.72));
    field += weight / (0.08 + filaments);
    weight *= 0.62;
    q = q.yx * vec2(-1.08, 1.04);
  }
  float glow = 1.0 - exp(-field * (0.018 + u_paramA * 0.04));
  return palette(clamp(glow, 0.0, 1.0));
}
`;

// "Halftone" — 21st.dev pattern shader.
const SHADE_HALFTONE = `
vec3 shade(vec2 uv, vec2 p, float t) {
  float cells = 18.0 + u_intensity * 30.0;
  vec2 f = fract(p * cells) - 0.5;
  float field = 0.5 + 0.5 * sin(p.x * 3.0 + t + u_seed) * sin(p.y * 2.4 - t * 0.7);
  float r = (0.06 + u_paramA * 0.34) + field * 0.2;
  float dotMask = 1.0 - smoothstep(r - 0.08, r, length(f));
  return mix(u_colors[0], palette(field), dotMask);
}
`;

// "Silk" — 21st.dev Shader Builder silk shader.
const SHADE_SILK = `
vec3 shade(vec2 uv, vec2 p, float t) {
  vec2 q = p * 1.6;
  float amp = 0.25 + u_intensity * 0.85;
  for (float i = 1.0; i < 5.0; i += 1.0) {
    q.x += amp / i * cos(i * 2.4 * q.y + t * 0.8 + u_seed);
    q.y += amp / i * cos(i * 1.7 * q.x + t * 0.6);
  }
  return palette(0.5 + 0.5 * sin(q.x + q.y));
}
`;

const COMMON_MAIN = `
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 screenUv = uv;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy)
    / min(u_resolution.x, u_resolution.y);

  float cursorMask = 0.0;
  if (u_cursorPresence > 0.001) {
    vec2 cursor = (0.5 * u_mouse * u_resolution.xy)
      / min(u_resolution.x, u_resolution.y);
    vec2 cursorDelta = p - cursor;
    if (u_cursorEffect < 0.5) {
      p += cursor * u_cursorPresence * u_cursorStrength * 0.55;
    } else {
      float cursorDistance = length(cursorDelta);
      vec2 cursorDirection = cursorDelta / max(cursorDistance, 0.0001);
      cursorMask = u_cursorPresence
        * (1.0 - smoothstep(0.0, u_cursorRadius, cursorDistance));
      if (u_cursorEffect < 1.5) {
        p -= cursorDirection * cursorMask * u_cursorStrength * 0.24;
      } else if (u_cursorEffect < 2.5) {
        float cursorAngle = cursorMask * u_cursorStrength * 2.2;
        float cc = cos(cursorAngle), cs = sin(cursorAngle);
        p = cursor + mat2(cc, -cs, cs, cc) * cursorDelta;
      } else if (u_cursorEffect < 3.5) {
        float ripple = sin(
          cursorDistance / max(u_cursorRadius, 0.001) * 18.0 - u_time * 5.0);
        p -= cursorDirection * ripple * cursorMask * u_cursorStrength * 0.07;
      }
    }
  }

  uv = p * min(u_resolution.x, u_resolution.y) / u_resolution.xy + 0.5;
  p *= u_scale;

  if (abs(u_rotate) > 0.0001) {
    float cr = cos(u_rotate), sr = sin(u_rotate);
    p = mat2(cr, -sr, sr, cr) * p;
  }
  p += u_offset;
  if (u_drift > 0.0001)
    p += u_drift * vec2(sin(u_time * 0.31), cos(u_time * 0.23));

  if (u_warp > 0.0) {
    p += u_warp * (vec2(
      fbm(p * u_detail + u_seed),
      fbm(p * u_detail + vec2(5.2, 1.3))) - 0.5);
  }

  vec3 col;
  if (u_blur > 0.0) {
    float e = u_blur;
    float pe = e * u_scale;
    vec2 uvE = vec2(e) * min(u_resolution.x, u_resolution.y) / u_resolution.xy;
    col  = shade(uv, p, u_time) * 0.36;
    col += shade(uv + vec2(uvE.x, 0.0), p + vec2(pe, 0.0), u_time) * 0.16;
    col += shade(uv - vec2(uvE.x, 0.0), p - vec2(pe, 0.0), u_time) * 0.16;
    col += shade(uv + vec2(0.0, uvE.y), p + vec2(0.0, pe), u_time) * 0.16;
    col += shade(uv - vec2(0.0, uvE.y), p - vec2(0.0, pe), u_time) * 0.16;
  } else {
    col = shade(uv, p, u_time);
  }

  if (abs(u_contrast - 1.0) > 0.0001)
    col = (col - 0.5) * u_contrast + 0.5;
  if (abs(u_saturation - 1.0) > 0.0001) {
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, u_saturation);
  }
  if (abs(u_hue) > 0.0001)
    col = hueRotate(col, u_hue);
  if (abs(u_brightness) > 0.0001)
    col += u_brightness;
  if (u_vignette > 0.0001) {
    float vd = length(screenUv - 0.5) * 1.41421356;
    col *= 1.0 - u_vignette * smoothstep(0.35, 1.0, vd);
  }
  if (u_cursorPresence > 0.001 && u_cursorEffect > 3.5)
    col += (vec3(0.18) + col * 0.12) * cursorMask * u_cursorStrength;
  if (u_grain > 0.0001)
    col += (grainHash(
      gl_FragCoord.xy + vec2(u_seed * 17.0, u_seed * 31.0)) - 0.5) * u_grain;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const FRAGS: Record<ShaderVariant, string> = {
  smoke: COMMON_HEAD + SHADE_SMOKE + COMMON_MAIN,
  "neuro-noise": COMMON_HEAD + SHADE_NEURO + COMMON_MAIN,
  halftone: COMMON_HEAD + SHADE_HALFTONE + COMMON_MAIN,
  silk: COMMON_HEAD + SHADE_SILK + COMMON_MAIN,
};

// Packed uniform presets (exact values from each style's recipe).
type Preset = {
  timeScale: number; // seconds multiplier fed into u_scene.z
  shape: [number, number, number, number];
  surface: [number, number, number, number];
  finish: [number, number, number, number];
  seed: number;
  rotate: number;
};

const PRESETS: Record<ShaderVariant, Preset> = {
  smoke: {
    timeScale: 0.97,
    shape: [1.72, 0.6, 0.5, 0.0],
    surface: [2.4, 1.3, 0.0, 1.0],
    finish: [0.0, 0.0, 0.0, 0.0],
    seed: 635,
    rotate: 0.0,
  },
  "neuro-noise": {
    timeScale: 0.82,
    shape: [2.5, 1.0, 0.71, 0.2],
    surface: [2.53, 1.07, 0.0, 1.0],
    finish: [0.0, 0.0, 0.0, 0.03],
    seed: 5.0,
    rotate: 6.28,
  },
  halftone: {
    timeScale: 1.43,
    shape: [1.48, 0.88, 0.5, 0.0],
    surface: [2.4, 0.91, 0.0, 1.0],
    finish: [0.0, 0.0, 0.0, 0.06],
    seed: 2926.0,
    rotate: 0.0,
  },
  silk: {
    timeScale: 0.575,
    shape: [1.26, 0.35, 0.28, 0.0],
    surface: [1.824, 1.221, 0.0, 1.0],
    finish: [0.0, 0.0, 0.0, 0.042],
    seed: 1928.0,
    rotate: 0.0,
  },
};

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("ShaderBackground compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function ShaderBackground({
  colors,
  variant = "smoke",
  seed,
  className,
}: ShaderBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) {
      console.error("[ShaderBackground] no webgl context");
      return;
    }

    const preset = PRESETS[variant];
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGS[variant]);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("ShaderBackground link error:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    // Fullscreen triangle.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const locColors = u("u_colors");
    const locScene = u("u_scene");
    const locShape = u("u_shape");
    const locSurface = u("u_surface");
    const locFinish = u("u_finish");
    const locTransform = u("u_transform");
    const locSpace = u("u_space");
    const locCursor = u("u_cursor");

    // Pad palette to 8 entries.
    const padded: number[] = [];
    for (let i = 0; i < 8; i++) {
      const c = colors[Math.min(i, colors.length - 1)];
      padded.push(c[0], c[1], c[2]);
    }
    gl.uniform3fv(locColors, new Float32Array(padded));

    gl.uniform4f(locShape, ...preset.shape);
    gl.uniform4f(locSurface, ...preset.surface);
    gl.uniform4f(locFinish, ...preset.finish);
    gl.uniform4f(locTransform, seed ?? preset.seed, preset.rotate, 0.0, 0.0);
    gl.uniform4f(locSpace, 0.0, 0.0, 0.0, 0.0);
    gl.uniform4f(locCursor, 0.0, 2.0, 0.65, 0.46);

    // Render at a reduced internal resolution: these are soft, blurred
    // backgrounds, so full-DPR pixels cost a lot and buy nothing.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * 0.6;
    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    let onScreen = true;
    const start = performance.now();
    const FRAME_MS = 1000 / 30;
    let last = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      last = now;
      const t = ((now - start) / 1000) * preset.timeScale;
      gl.uniform4f(locScene, canvas.width, canvas.height, t, Math.min(colors.length, 8));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const sync = () => {
      const shouldRun = onScreen && !document.hidden;
      if (!shouldRun && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (shouldRun && !raf) {
        raf = requestAnimationFrame(frame);
      }
    };
    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      sync();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    raf = requestAnimationFrame(frame);


    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", sync);
      io.disconnect();
      ro.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
