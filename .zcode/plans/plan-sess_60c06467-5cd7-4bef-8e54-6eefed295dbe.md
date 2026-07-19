## Plan: Transitions View Hover Animation Redesign

### เป้าหมาย
การ์ด transition ที่ดูเป็น "live preview" — ก่อน hover เห็น scene A ชัด, hover แล้วเล่น transition ping-pong loop สวย ๆ, card เองมี feedback (scale + ring + shadow).

### Behavior

| State | ทำอะไร |
|-------|-------|
| **Idle** | แสดง scene A (progress=0) นิ่ง — เห็นชัดว่าเป็น clip ต้นทาง |
| **Hover** | ping-pong loop: 0→1→0 (fade สลับ A↔B) รวม ~2400ms, ไม่มี jump |
| **Leave** | ค่อย ๆ กลับสู่ progress=0 อย่างนุ่น |
| **prefers-reduced-motion** | ข้าม animation, แสดงสถานะ progress=0.5 (A+B cross-fade 50/50) ให้เห็นทั้งสอง scene |

### Asset ใหม่

**สร้าง 2 ไฟล์** ใน `apps/web/public/preview/transitions/`:
- `scene-a.svg` — gradient landscape โทนอบอุ่น (sunset เขียว-ส้ม)
- `scene-b.svg` — gradient landscape โทนเย็น (ocean น้ำเงิน-ม่วง)

ทำเป็น SVG inline gradient (เบา, scalable, คอนทราสต์สูง เหมาะให้เห็น transition ชัด). เลียนแบบ pattern ที่มี (static SVGs ใน `public/logos/`).

### การเปลี่ยนแปลงใน `transitions.tsx`

**1. `TransitionPresetCard` (wrapper)** — lift hover state ขึ้น:
```tsx
const [isHovering, setIsHovering] = useState(false);
// ...
className={cn(
  "group bg-muted hover:bg-accent relative flex flex-col items-center gap-2 rounded-lg border p-3",
  "transition-all duration-200",
  "hover:scale-[1.03] hover:shadow-lg hover:ring-1 hover:ring-primary",
  isHovering && "scale-[1.03] shadow-lg ring-1 ring-primary",
)}
onMouseEnter={() => setIsHovering(true)}
onMouseLeave={() => setIsHovering(false)}
```
- ย้าย `onMouseEnter/Leave` จาก canvas มาที่การ์ดทั้งใบ (hit area ใหญ่ขึ้น)
- ส่ง `isHovering` prop ลง `TransitionPreview`

**2. `TransitionPreview`** — rewrite:
- `useEffect` preload 2 SVG ผ่าน `new Image()` async, เก็บใน ref
- รอจนกว่าทั้งสองโหลดเสร็จถึงจะวาด
- drawFrame เหมือนเดิม แต่ใช้ image drawImage แทน fillRect
- **Match renderer easing**: dissolve → `smoothstep(progress)`, อันอื่น linear
- **Ping-pong loop**: progress เดิน 0→1→0 ใน `DURATION` เดียว (`progress = elapsed < DURATION/2 ? elapsed*2/DURATION : 2 - elapsed*2/DURATION`)
- **Canvas สูงขึ้น**: `h-10` → `h-14`
- **prefers-reduced-motion**: check `window.matchMedia("(prefers-reduced-motion: reduce)")` ครั้งเดียวตอน mount, ถ้า reduce → วาดที่ progress=0.5 ค้างไว้

**3. Loophole fix เดิม** — `colors` memo ใช้ `getComputedStyle` ครั้งเดียวตอน mount, เปลี่ยน theme แล้วไม่ update. ลบทิ้งได้เพราะใช้ SVG แทนแล้ว (ไม่ต้องอ่าน CSS var).

### Implementation Details

**Easing match (สำคัญ เพื่อให้ preview = ของจริง):**
```ts
const eased = type === "dissolve"
  ? progress * progress * (3 - 2 * progress)  // smoothstep
  : progress;
```

**Ping-pong (ลบ jarring restart):**
```ts
const cycle = (t - start) % DURATION;
const half = DURATION / 2;
const progress = cycle < half ? cycle / half : 2 - cycle / half;
```

**Preload pattern:**
```ts
const imgA = new Image();
imgA.src = "/preview/transitions/scene-a.svg";
imgA.onload = () => { loadedRef.current.a = imgA; tryDraw(); };
// เหมือนกันสำหรับ B
```

### Files Touched

| File | Action |
|------|--------|
| `apps/web/public/preview/transitions/scene-a.svg` | **สร้างใหม่** |
| `apps/web/public/preview/transitions/scene-b.svg` | **สร้างใหม่** |
| `apps/web/src/components/editor/panels/assets/views/transitions.tsx` | **แก้ไข** — TransitionPresetCard + TransitionPreview rewrite (~80 บรรทัดเปลี่ยน) |

### ไม่เปลี่ยน
- `transition-constants.ts` — preset list คงเดิม
- `transition-node.ts` — real renderer คงเดิม
- `types/timeline.ts` — type คงเดิม

### Trade-offs

| ✓ ได้ | ✗ เสีย |
|------|-------|
| Preview = ของจริงเป๊ะ (easing match) | เพิ่ม 2 SVG file (~1KB รวม) |
| UX ดีขึ้นมาก (hit area ใหญ่, feedback ชัด) | นำเสนอ pattern ใหม่ (scale+ring+shadow) ใน editor panel — ไม่มี precedent แต่เหมาะสม |
| ปรับ theme ได้ไม่ติดขัด (SVG, ไม่ต้องอ่าน CSS var) | — |
| เคารพ reduced-motion | — |

### ขั้นตอนหลัง implement
1. รีเฟรช `http://localhost:4100` → เปิด editor → tab Transitions
2. ตรวจดู: idle แสดง scene A, hover เล่น ping-pong, leave กลับ scene A
3. ทดสอบเปลี่ยน theme (light/dark)
4. ทดสอบเปิด OS "reduce motion" ดูว่าค้างที่ progress=0.5