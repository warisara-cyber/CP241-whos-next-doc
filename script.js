/* =====================================================================
   แผนที่โค้ด (เพราะ ฉันขี้เกียจอ่านแยกแต่ละจุดเพราะมันตาลายอย่างยิ่ง)
   ---------------------------------------------------------------------
   เกมนี้ให้ผู้เล่นเลือก Sorting Algorithm 1 ใน 4 ตัวเพื่อจัดคิวผู้ป่วยให้ได้ลำดับที่ถูกต้อง (กฎของโรงพยาบาล)
   การจัดคิวทุกขั้นตอนกินเวลา ทำให้ผู้ป่วยทุกคนรอเพิ่ม คะแนนจึงมาจาก "จำนวนขั้นตอนจริง" ที่ Algorithm นั้นใช้
   เทียบกับวิธีที่ดีที่สุดของวัน ดังนั้น Sorting คือแกนของเกม ไม่ใช่ของตกแต่ง

   PART 0  ค่าตั้งต้นของเกม            ปรับความยาก/เกณฑ์ผ่านที่นี่ (OP_MIN, ER_EXAM, DAYS)
   PART 1  SORTING ALGORITHMS      Bubble / Selection / Insertion / Merge  <<< ส่วนที่อาจารย์ตรวจ
   PART 2  โมเดลข้อมูลและคะแนน      สร้างผู้ป่วย, สร้างคิว, นับขั้นตอน/เวลารอ, เทียบทุกวิธี (ไม่ยุ่งกับหน้าจอ)
   PART 3  สถานะเกม                ตัวแปร G เก็บทุกอย่างที่เปลี่ยนระหว่างเล่น
   PART 4  วาดหน้าจอ               draw() และฟังก์ชันย่อยที่สร้าง HTML
   PART 5  การเล่น                 runSort() ให้ Algorithm ทำงานทีละขั้น, submit() ตัดสินผล
   PART 6  หน้าต่างผล/สรุป/ปุ่ม       dialog ผลรายวัน, สรุปท้ายเกม, ตารางสรุป, ปุ่มต่าง ๆ

   อยากแก้อะไร?   ความยาก/เกณฑ์ผ่าน -> PART 0     วิธีคิดคะแนน -> simulateAll() และ submit()
                   เพิ่ม Algorithm -> เขียน generator ใน PART 1 แล้วเพิ่มใน ALGOS
   ===================================================================== */

/* ===================== PART 0: ค่าตั้งต้นของเกม ===================== */

const OP_MIN = 1;     // การเปรียบเทียบหรือย้าย 1 ครั้ง = ใช้เวลาจัดคิว 1 นาที (ทุกคนในคิวรอเพิ่ม)
const ER_EXAM = 30;   // วัน ER: ผู้ป่วยแต่ละคนใช้เวลาตรวจ 30 นาที
const HEARTS = 3;     // จำนวนหัวใจ (โอกาสพลาด)
// นิยามของ 3 วัน: type = ER (เรียงตามความรุนแรง) หรือ OR (เรียงตามเวลาผ่าตัด)
//   shape = สภาพคิวตอนเริ่ม, tol = เกณฑ์ผ่าน ยอมให้ใช้ขั้นตอนมากกว่าวิธีที่ดีที่สุดได้กี่ %
//   (ค่า tol ได้จากการจำลองหลายพันรอบ: วันสุ่มผลแกว่ง จึงผ่อนปรน 25% ส่วนวันที่สภาพคิวชี้ชัดใช้ 10%)
const DAYS = [
  { type: 'er', n: 9, shape: 'random', tol: 0.25, title: 'วันที่ 1 · เวรเช้า ห้องฉุกเฉิน (ER)', cond: 'คิวสุ่ม' },
  { type: 'or', n: 10, shape: 'nearly', tol: 0.10, title: 'วันที่ 2 · ช่วงบ่าย ห้องผ่าตัด (OR)', cond: 'คิวถูกจัดไว้แล้วแต่มีเคสสลับที่ 3 คู่ (เกือบเรียง)' },
  { type: 'er', n: 10, shape: 'append', tol: 0.10, title: 'วันที่ 3 · เวรดึก ER ผู้ป่วยใหม่เข้ามา', cond: 'คิวเรียงไว้แล้ว 7 คน แต่มีผู้ป่วยใหม่ 3 คนมาต่อท้าย' }
];

/* ===================== PART 1: SORTING ALGORITHMS =====================
   ทุกวิธีเขียนเป็น generator (function*) รับอาร์เรย์ของ "เลขลำดับความสำคัญ" (k)
   เลข k น้อย = ต้องเข้าตรวจก่อน เรียงจากน้อยไปมาก (ER ใช้ k = 11 − ความรุนแรง, OR ใช้ k = เวลาผ่าตัด)
   generator "เรียงอาร์เรย์จริง ๆ" ทีละขั้น แล้ว yield เหตุการณ์ออกมา:
     {k:'c', i, j}  = Comparison  เปรียบเทียบคนตำแหน่ง i กับ j   (นับ 1 ขั้น)
     {k:'w', i, j?} = Move        สลับ i กับ j  หรือเขียนค่าลงตำแหน่ง i (นับ 1 ขั้น)
   เกมนำเหตุการณ์ไปทำ 2 อย่าง: (1) ขยับการ์ดให้เห็น (2) นับขั้นตอน = เวลาจัดคิว 
*/

/* ---------- 1) Bubble Sort ----------
   วิธีคิด: เดินจากหน้าคิวไปท้ายคิว เทียบ "คนที่ยืนติดกัน" ทีละคู่ ถ้าคู่ไหนอยู่ผิดลำดับก็สลับ
            จบรอบหนึ่ง คนที่ควรอยู่ท้ายสุดจะถูกดันไปท้ายสุด (เหมือนฟองอากาศลอยขึ้น) แล้วทำซ้ำ
   ตัวอย่าง [3,1,2]: เทียบ(3,1) สลับ -> [1,3,2]; เทียบ(3,2) สลับ -> [1,2,3]; รอบสองไม่มีการสลับ จึงหยุด
   ข้อดี: ถ้าคิวเกือบเรียง จะหยุดเร็วเพราะ "รอบที่ไม่มีการสลับ" แปลว่าเรียงเสร็จแล้ว (early-exit)
   ข้อเสีย: คิวที่ผิดลำดับมาก ๆ ต้องสลับทีละคู่ จึงสลับเยอะ 
*/

function* bubble(a) {
  const n = a.length;
  for (let i = 0; i < n - 1; i++) {              // รอบที่ i: คนท้ายคิว i คนสุดท้ายถูกจัดที่แล้ว
    let swapped = false;                         // จำว่ารอบนี้มีการสลับไหม
    for (let j = 0; j < n - 1 - i; j++) {        // เทียบคู่ (j, j+1) ทีละคู่
      yield { k: 'c', i: j, j: j + 1 };          // เปรียบเทียบ 1 ครั้ง
      if (a[j] > a[j + 1]) {                     // ถ้าคนซ้ายควรมาทีหลังคนขวา = ผิดลำดับ
        [a[j], a[j + 1]] = [a[j + 1], a[j]];     // สลับที่
        swapped = true;
        yield { k: 'w', i: j, j: j + 1 };        // ย้าย 1 ครั้ง
      }
    }
    if (!swapped) return;                        // ทั้งรอบไม่มีการสลับ = เรียงเสร็จแล้ว หยุดได้เลย
  }
}

/* ---------- 2) Selection Sort ----------
   วิธีคิด: ทุกรอบ "ไล่หาคนที่ควรมาก่อนที่สุด" ในส่วนที่ยังไม่จัด แล้วสลับเขามาไว้ตำแหน่งหน้าสุดของส่วนนั้น
   ตัวอย่าง [3,1,2]: รอบแรกหาน้อยสุดคือ 1 สลับกับ 3 -> [1,3,2]; รอบสองน้อยสุดคือ 2 สลับกับ 3 -> [1,2,3]
   ข้อดี: สลับน้อย (ไม่เกิน n−1 ครั้ง)
   ข้อเสีย: ต้องไล่เทียบเท่าเดิมทุกรอบ แม้คิวเกือบเรียงอยู่แล้ว (เทียบ n(n−1)/2 ครั้งเสมอ) 
*/

function* selection(a) {
  const n = a.length;
  for (let i = 0; i < n - 1; i++) {              // i = ตำแหน่งที่กำลังจะเติมคนที่ถูกต้อง
    let m = i;                                   // m = ตำแหน่งของ "คนที่ควรมาก่อนสุด" เท่าที่เจอ
    for (let j = i + 1; j < n; j++) {
      yield { k: 'c', i: m, j };                 // เปรียบเทียบ 1 ครั้ง
      if (a[j] < a[m]) m = j;                    // เจอคนที่ควรมาก่อนกว่า จำตำแหน่งไว้
    }
    if (m !== i) {                               // ถ้าคนที่เหมาะอยู่ผิดที่ ค่อยสลับ
      [a[i], a[m]] = [a[m], a[i]];
      yield { k: 'w', i, j: m };                 // ย้าย 1 ครั้ง
    }
  }
}

/* ---------- 3) Insertion Sort ----------
   วิธีคิด: เหมือนเรียงไพ่ในมือ หยิบคนถัดไป (key) มาแทรกเข้าในส่วนหน้าที่ "เรียงแล้ว"
            โดยเลื่อนคนที่ควรอยู่หลัง key ไปทางขวา แล้ววาง key ลงช่องว่าง
   ตัวอย่าง [1,3,2]: key=2 เทียบ 3 (3 ควรอยู่หลัง) เลื่อน 3 ไปขวา เทียบ 1 (1 ควรอยู่หน้า) หยุด วาง 2 -> [1,2,3]
   ข้อดี: ส่วนที่เรียงแล้วแค่เช็กผ่าน ไม่ต้องย้าย คิวเกือบเรียงหรือมีคนใหม่มาต่อท้ายจึงเร็วมาก
   ข้อเสีย: คิวที่ผิดลำดับมาก ๆ ต้องเลื่อนคนเยอะ 
*/

function* insertion(a) {
  for (let i = 1; i < a.length; i++) {           // ตำแหน่ง 0..i-1 คือส่วนที่เรียงแล้ว
    const key = a[i];                            // คนที่หยิบมาแทรก
    let j = i - 1;
    while (j >= 0) {
      yield { k: 'c', i: j, j: j + 1 };          // เปรียบเทียบ key กับคนในส่วนที่เรียงแล้ว
      if (a[j] > key) {                          // คนนี้ควรอยู่หลัง key -> เลื่อนไปขวา 1 ช่อง
        a[j + 1] = a[j];
        yield { k: 'w', i: j + 1 };              // ย้าย 1 ครั้ง (เลื่อน 1 ช่อง)
        j--;
      } else break;                             // เจอคนที่ควรอยู่หน้า key แล้ว หยุดหาที่วาง
    }
    if (j + 1 !== i) {                          // ถ้า key ต้องขยับจากที่เดิม
      a[j + 1] = key;                           // วาง key ลงช่องว่างที่ถูกต้อง
      yield { k: 'w', i: j + 1 };               // ย้าย 1 ครั้ง (วาง key)
    }
  }
}

/* ---------- 4) Merge Sort ----------
   วิธีคิด: แบ่งคิวครึ่งหนึ่งซ้ำ ๆ จนเหลือคนเดียว (คนเดียวถือว่าเรียงแล้ว) แล้ว "รวม" สองฝั่งที่เรียงแล้วกลับเข้าด้วยกัน
            ตอนรวม: เทียบ "หัวแถว" ของสองฝั่ง ใครควรมาก่อนก็เขียนลงคิวก่อน
   ตัวอย่าง รวม [1,4] กับ [2,3]: เทียบ(1,2) เขียน 1; เทียบ(4,2) เขียน 2; เทียบ(4,3) เขียน 3; เหลือ 4 เขียนต่อ -> [1,2,3,4]
   ข้อดี: จำนวนขั้นตอนใกล้เคียงกันเสมอ ไม่ว่าคิวจะสภาพไหน และโตช้ากว่าวิธีอื่นเมื่อคิวยาวขึ้นมาก
   ข้อเสีย: แม้คิวเรียงเกือบหมดแล้วก็ยังต้องแบ่งและรวมใหม่ทั้งหมด (และต้องใช้ที่พักชั่วคราว L, R) 
*/

function* mergeSort(a, lo = 0, hi = a.length - 1) {
  if (lo >= hi) return;                          // เหลือคนเดียว = เรียงแล้ว
  const mid = (lo + hi) >> 1;                    // จุดแบ่งครึ่ง
  yield* mergeSort(a, lo, mid);                  // จัดครึ่งซ้าย
  yield* mergeSort(a, mid + 1, hi);              // จัดครึ่งขวา
  const L = a.slice(lo, mid + 1), R = a.slice(mid + 1, hi + 1);   // ที่พักชั่วคราวของสองครึ่งที่เรียงแล้ว
  let i = 0, j = 0, k = lo;                            // i,j = หัวแถวของ L,R ; k = ตำแหน่งที่จะเขียนผลลัพธ์
  while (i < L.length && j < R.length) {
    yield { k: 'c', i: lo + i, j: mid + 1 + j };            // เปรียบเทียบหัวแถวสองฝั่ง
    if (L[i] <= R[j]) a[k] = L[i++]; else a[k] = R[j++];// เอาคนที่ควรมาก่อนลงคิว
    yield { k: 'w', i: k }; k++;                     // เขียนลงคิว = ย้าย 1 ครั้ง
  }
  while (i < L.length) { a[k] = L[i++]; yield { k: 'w', i: k }; k++; }   // ฝั่งซ้ายที่เหลือ เขียนต่อท้าย
  while (j < R.length) { a[k] = R[j++]; yield { k: 'w', i: k }; k++; }   // ฝั่งขวาที่เหลือ เขียนต่อท้าย
}

// รายชื่อ Algorithm ที่ผู้เล่นเลือกได้ (name = ชื่อบนปุ่ม, tag/hint = คำอธิบายสั้นบนปุ่ม)
const ALGOS = {
  bubble: { name: 'Bubble Sort', fn: bubble, tag: 'สลับคู่ที่ยืนติดกันซ้ำ ๆ', hint: 'หยุดเองเมื่อไม่มีอะไรให้สลับ' },
  selection: { name: 'Selection Sort', fn: selection, tag: 'หาคนที่ควรมาก่อนแล้วสลับขึ้นหน้า', hint: 'ย้ายน้อย แต่เทียบเท่าเดิมเสมอ' },
  insertion: { name: 'Insertion Sort', fn: insertion, tag: 'แทรกทีละคนเข้าแถวที่เรียงแล้ว', hint: 'ถนัดคิวที่เรียงไว้เกือบหมดแล้ว' },
  merge: { name: 'Merge Sort', fn: mergeSort, tag: 'แบ่งครึ่งแล้วรวมกลับ', hint: 'ขั้นตอนใกล้เคียงกันทุกสภาพคิว' }
};
/* ===================== END PART 1 ===================== */

/* ===================== PART 2: โมเดลข้อมูลและคะแนน (ไม่เกี่ยวกับหน้าจอ) ===================== */

const rnd = n => Math.floor(Math.random() * n);                    // สุ่มจำนวนเต็ม 0..n-1
const isSorted = a => a.every((v, i) => i === 0 || a[i - 1] <= v);          // อาร์เรย์เรียงน้อย->มากแล้วหรือยัง
function shuffled(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]]; } return a; }
const sample = (n, arr) => shuffled(arr).slice(0, n);              // สุ่มหยิบ n ตัวไม่ซ้ำ

// สร้างผู้ป่วยและคิวเริ่มต้นของวันหนึ่ง
//  คืน {byK, queue}: byK = ค้นผู้ป่วยจากเลข k, queue = ลำดับคิวตอนเริ่ม (อาร์เรย์ของ k)
//  ผู้ป่วยแต่ละคน: k = เลขจัดเรียง (น้อย=ก่อน), d = เวลาที่หมอใช้กับเขา (นาที)
function makeDay(def) {
  const n = def.n; let pts;
  if (def.type === 'er') {      // ER: ความรุนแรง 1-10 (ไม่ซ้ำกัน), หนักมากต้องมาก่อน จึงให้ k = 11 − ความรุนแรง
    pts = sample(n, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map(s => ({ k: 11 - s, sev: s, d: ER_EXAM }));
  } else {                    // OR: เวลาผ่าตัด 20-120 นาที (ไม่ซ้ำกัน), เคสสั้นเข้าก่อน จึงให้ k = เวลาผ่าตัด
    pts = sample(n, Array.from({ length: 21 }, (_, i) => 20 + 5 * i)).map(x => ({ k: x, dur: x, d: x }));
  }
  const byK = {}; pts.forEach(p => byK[p.k] = p);
  const ks = pts.map(p => p.k).sort((a, b) => a - b);                 // ลำดับที่ "ถูกต้อง"
  let q;
  if (def.shape === 'random') {                                  // คิวสุ่มทั้งแถว
    do q = shuffled(ks); while (isSorted(q));
  } else if (def.shape === 'nearly') {                            // เรียงถูกหมด แล้วสลับ 3 คู่ (ห่างกัน 2 ช่อง)
    q = [...ks]; const b = rnd(2);
    for (const i of [b, b + 3, b + 6]) [q[i], q[i + 2]] = [q[i + 2], q[i]];
  } else {                                                     // append: เรียงแล้ว n−3 คน + ผู้ป่วยใหม่ 3 คนต่อท้าย
    const nw = shuffled(ks).slice(0, 3); nw.forEach(k => byK[k].isNew = true);
    const old = ks.filter(k => !nw.includes(k));
    let tail; do tail = shuffled(nw); while (isSorted([...old, ...tail]));
    q = [...old, ...tail];
  }
  return { byK, queue: q };
}

// คำนวณ "เวลารอ" ของลำดับคิวหนึ่ง (ใช้แสดงผลให้เห็นผลกระทบต่อผู้ป่วย)
//   เวลารอของผู้ป่วยแต่ละคน = (เวลาที่ใช้จัดคิว P) + (เวลาตรวจของทุกคนที่เข้าก่อนหน้า)
//   ทุก Algorithm ได้ลำดับสุดท้ายเหมือนกัน ต่างกันที่ P เท่านั้น: จัดคิวนานเท่าไร ทุกคนรอเพิ่มเท่านั้น
function evalOrder(order, byK, ops) {
  const P = ops * OP_MIN; let t = P; const waits = [];
  for (const k of order) { waits.push(t); t += byK[k].d; }
  return { ops, P, waits };
}

// ลองทุก Algorithm กับคิวเดียวกัน (สำเนา) เพื่อหา "วิธีที่ใช้ขั้นตอนน้อยที่สุดของวันนี้" ใช้ตัดสินคะแนนและเกณฑ์ผ่าน
function simulateAll(queue, byK, tol) {
  const rows = [];
  for (const name in ALGOS) {
    const a = [...queue]; let c = 0, m = 0;
    for (const e of ALGOS[name].fn(a)) { if (e.k === 'c') c++; else m++; }   // นับขั้นตอนเหมือนตอนเล่นจริง
    rows.push({ name, c, m, ok: isSorted(a), ...evalOrder(a, byK, c + m) });
  }
  const best = rows.reduce((x, y) => y.ops < x.ops ? y : x);           // วิธีที่ใช้ขั้นตอนน้อยสุด = จัดคิวเร็วสุด
  return { rows, best, limit: Math.ceil(best.ops * (1 + tol)) * OP_MIN };   // เกณฑ์ผ่าน (นาที) = ช้ากว่าที่ดีที่สุดได้ไม่เกิน tol
}

/* ===================== PART 3: สถานะเกม ===================== */
// ชื่อผู้ป่วยสมมติ (kind: kid/adult/old ใช้สุ่มอายุให้เข้ากับชื่อ)

const NAMES = [['คุณป้าสมศรี', 'old'], ['ลุงชัยวัฒน์', 'old'], ['น้องมะลิ', 'kid'], ['คุณวิภา', 'adult'], ['พี่ธนา', 'adult'], ['น้องภูผา', 'kid'],
['คุณยายบุญเรือน', 'old'], ['คุณมาลี', 'adult'], ['พี่ณัฐ', 'adult'], ['น้องข้าวหอม', 'kid'], ['คุณสุรชัย', 'adult'], ['คุณอรทัย', 'adult'],
['น้องไอริน', 'kid'], ['ลุงประสิทธิ์', 'old'], ['คุณพรทิพย์', 'adult'], ['น้องกันต์', 'kid'], ['คุณนภา', 'adult'], ['พี่เอก', 'adult'],
['คุณยายทองคำ', 'old'], ['น้องฟ้าใส', 'kid'], ['คุณสมหมาย', 'adult'], ['คุณจิราพร', 'adult']];
const AGE = { kid: [4, 14], adult: [20, 55], old: [62, 85] };
function assignNames(byK) {                    // ใส่ชื่อ-อายุให้ผู้ป่วยแต่ละคน (ใช้แค่ตกแต่ง ไม่กระทบคะแนน)
  const pool = shuffled(NAMES);
  Object.values(byK).forEach((p, i) => { const [nm, kind] = pool[i]; const [lo, hi] = AGE[kind]; p.name = nm; p.age = lo + rnd(hi - lo + 1); });
}
const $ = s => document.querySelector(s), sleep = ms => new Promise(r => setTimeout(r, ms));
const DELAY = { slow: 350, normal: 150, fast: 40 };     // หน่วงต่อ 1 ขั้นตอนตอนแสดงภาพ (มิลลิวินาที)
// G = สถานะทั้งหมดของเกม
const G = {
  day: 0, score: 0, hearts: HEARTS, retries: 0, log: [],
  byK: {}, start: [], arr: [], plan: null, def: null,
  c: 0, m: 0, hl: {}, chosen: null, busy: false, sorted: false, sent: false, skip: false, tok: 0,
  gMax: 0, res: null
};   // c = นับเปรียบเทียบ, m = นับย้าย, gMax = ค่าสูงสุดของมาตรวัดเวลาจัดคิว

// เริ่มเกมใหม่ทั้งหมด
function startGame() { G.day = 0; G.score = 0; G.hearts = HEARTS; G.log = []; G.retries = 0; $('#menu').hidden = true; $('#game').hidden = false; loadDay(true); }
// เตรียมวัน: fresh=true สร้างผู้ป่วย/คิวใหม่, false = เล่นคิวเดิมซ้ำ (ตอนลองใหม่)
function loadDay(fresh) {
  const def = DAYS[G.day]; G.def = def;
  if (fresh) {
    G.retries = 0;
    const d = makeDay(def); G.byK = d.byK; G.start = d.queue; assignNames(G.byK);
    G.plan = simulateAll(G.start, G.byK, def.tol);               // คำนวณวิธีที่ดีที่สุดล่วงหน้า (ผู้เล่นยังไม่เห็น)
  }
  G.tok++; G.arr = [...G.start]; G.c = G.m = 0; G.hl = {}; G.chosen = null; G.busy = false; G.sorted = false; G.sent = false; G.skip = false;
  G.gMax = Math.max(...G.plan.rows.map(r => r.P), G.plan.limit) * 1.05;   // มาตรวัดกว้างพอให้ถึงวิธีที่ใช้ขั้นตอนมากสุด
  setMsg(`${def.cond}. เลือกวิธีจัดคิวด้านล่างได้เลย`);
  draw();
}
function setMsg(t) { $('#msg').textContent = t; }

/* ===================== PART 4: วาดหน้าจอ ===================== */
// ป้ายสี Triage ของ ER: >=8 แดง วิกฤต, 5-7 เหลือง เร่งด่วน, <=4 เขียว ไม่เร่งด่วน

function triage(sev) { return sev >= 8 ? { c: 'var(--red)', t: 'วิกฤต' } : sev >= 5 ? { c: 'var(--yel)', t: 'เร่งด่วน' } : { c: 'var(--grn)', t: 'ไม่เร่งด่วน' }; }
// HTML ของการ์ดผู้ป่วยหนึ่งใบ (k = เลขจัดเรียงของคนที่อยู่ช่อง i)
function ptHTML(k, i) {
  const p = G.byK[k], er = G.def.type === 'er';
  const cls = 'pt' + (G.hl[i] ? ' ' + G.hl[i] : '') + (G.sorted && !G.busy ? ' fin' : '');
  const tg = er ? triage(p.sev) : { c: 'var(--teal)', t: 'เวลาผ่าตัด' };
  const val = er ? `${p.sev}<small>/10</small>` : `${p.dur}<small> นาที</small>`;
  const w = er ? p.sev * 10 : p.dur / 120 * 100;
  return `<div class="${cls}" style="--tag:${tg.c};--w:${w}%"><span class="band"></span>
    <div class="slot">คิวที่ ${i + 1}</div>
    <div class="nm">${p.name} <small>${p.age} ปี</small></div>
    <div class="val">${val}</div><div class="meter"><i></i></div>
    <div class="lab">${er ? 'ความรุนแรง · ' + tg.t : tg.t}</div>${p.isNew ? '<span class="new">ใหม่</span>' : ''}</div>`;
}
function draw() {
  const d = G.def, er = d.type === 'er';
  // แถบสถานะ: วัน, คะแนน, หัวใจ
  $('#stats').innerHTML = `<div class="stat"><b>${G.day + 1}/${DAYS.length}</b><span>วันที่</span></div>
    <div class="stat"><b>${G.score}</b><span>คะแนนรวม</span></div>
    <div class="stat"><div class="hearts" aria-label="หัวใจ ${G.hearts} ดวง">${Array.from({ length: HEARTS }, (_, i) => `<svg class="i hrt ${i < G.hearts ? 'on' : ''}"><use href="#i-heart"/></svg>`).join('')}</div><span>หัวใจที่เหลือ</span></div>
    <div class="stat"><b>${G.retries}</b><span>ลองวันนี้ซ้ำ (−10/ครั้ง)</span></div>`;

  // ฉากของวัน: ER = ม่านกั้นเตียงสีเขียวมิ้นต์, OR = โคมไฟผ่าตัดสีฟ้า
  $('#scene').className = 'scene ' + d.type;
  const lamp = er ? '' : `<svg class="lamp" viewBox="0 0 64 40" aria-hidden="true"><rect x="30" y="0" width="4" height="8" fill="#58737a"/><ellipse cx="32" cy="22" rx="26" ry="13" fill="#fff" stroke="#58737a" stroke-width="2"/><ellipse cx="32" cy="22" rx="13" ry="6" fill="#ffe7a8"/></svg>`;
  const goal = er ? 'ตามหลัก Triage ต้องจัดให้ผู้ป่วยที่ <b>อาการหนักกว่า (เลขความรุนแรงมากกว่า) อยู่หน้าคิว</b>'
    : 'ตามนโยบายห้องผ่าตัด ต้องจัดให้เคสที่ <b>ใช้เวลาผ่าตัดสั้นกว่าเข้าก่อน</b> เพื่อให้คนที่เหลือรอรวมน้อยที่สุด';
  const used = (G.c + G.m) * OP_MIN, pct = Math.min(100, used / G.gMax * 100), lim = G.plan.limit / G.gMax * 100;
  $('#scene').innerHTML = `<h2>${lamp}${d.title}</h2>
    <p class="goal">${goal} จัดให้ถูกด้วย <b>เวลาจัดคิวน้อยที่สุด</b> เพราะระหว่างจัดคิว ผู้ป่วยทุกคนต้องรอ</p>
    <p class="formula">เวลารอของผู้ป่วย = เวลาที่ใช้จัดคิว + เวลาตรวจของคนที่เข้าก่อนหน้า</p>
    <div class="gauge"><div class="gtxt"><span>เวลาจัดคิวที่ใช้ไป <b>${used}</b> นาที</span><span>เกณฑ์ผ่าน ไม่เกิน <b>${G.plan.limit}</b> นาที</span></div>
    <div class="track"><div class="fill ${used <= G.plan.limit ? 'good' : ''}" style="width:${pct}%"></div><span class="mark" style="left:${lim}%" title="เกณฑ์ผ่าน"></span></div></div>`;
  $('#legend').innerHTML = er ? `<span><i style="background:var(--red)"></i>วิกฤต (8-10)</span><span><i style="background:var(--yel)"></i>เร่งด่วน (5-7)</span><span><i style="background:var(--grn)"></i>ไม่เร่งด่วน (1-4)</span><span><i style="background:var(--cmp)"></i>กำลังเปรียบเทียบ</span><span><i style="background:var(--mov)"></i>กำลังย้าย</span>`
    : `<span><i style="background:var(--cmp)"></i>กำลังเปรียบเทียบ</span><span><i style="background:var(--mov)"></i>กำลังย้าย</span><span>ซ้ายไปขวา, บนลงล่าง = ลำดับเข้าตรวจ</span>`;
  $('#queue').innerHTML = G.arr.map((k, i) => ptHTML(k, i)).join('');
  $('#counters').innerHTML = `<div class="stat"><b>${G.c}</b><span>เปรียบเทียบ (ครั้ง)</span></div><div class="stat"><b>${G.m}</b><span>ย้าย (ครั้ง)</span></div>
    <div class="stat"><b>${(G.c + G.m) * OP_MIN}</b><span>เวลาจัดคิว (นาที)</span></div>`;
  // ปุ่มเลือกวิธี: เลือกได้ครั้งเดียวต่อวัน
  $('#picker').innerHTML = Object.keys(ALGOS).map(k => `<button class="pick${G.chosen === k ? ' on' : ''}" data-k="${k}"${G.chosen ? ' disabled' : ''}><b>${ALGOS[k].name}</b><span>${ALGOS[k].tag}</span><small>${ALGOS[k].hint}</small></button>`).join('');
  $('#sendBtn').hidden = !(G.sorted && !G.sent);
  $('#skipBtn').hidden = !G.busy;
}

/* ===================== PART 5: การเล่น ===================== */
// ให้ Algorithm ที่ผู้เล่นเลือกทำงานกับคิวจริง ทีละเหตุการณ์

async function runSort(name) {
  if (G.busy || G.chosen || G.sent) return;
  G.busy = true; G.chosen = name; G.skip = false; const my = ++G.tok;
  setMsg(`${ALGOS[name].name} กำลังจัดคิว ทุกการเปรียบเทียบหรือย้ายใช้เวลา ${OP_MIN} นาที`);
  const gen = ALGOS[name].fn(G.arr);                // generator นี้เรียง G.arr จริง ๆ ทีละขั้น
  draw();
  while (G.tok === my) {
    const x = gen.next(); if (x.done) break;           // x.done = Algorithm ทำงานเสร็จ
    const e = x.value;
    if (e.k === 'c') { G.c++; G.hl = { [e.i]: 'cmp', [e.j]: 'cmp' }; }                       // เปรียบเทียบ: ไฮไลต์สีฟ้า
    else { G.m++; G.hl = e.j == null ? { [e.i]: 'mov' } : { [e.i]: 'mov', [e.j]: 'mov' }; }        // ย้าย: ไฮไลต์สีพีช
    if (!G.skip) { draw(); await sleep(DELAY[$('#speed').value]); }
  }
  if (G.tok !== my) return;
  G.hl = {}; G.busy = false; G.sorted = isSorted(G.arr);
  setMsg(`จัดคิวเสร็จ: เปรียบเทียบ ${G.c} + ย้าย ${G.m} = ${G.c + G.m} ขั้นตอน (${(G.c + G.m) * OP_MIN} นาที) กด "ส่งคิวให้หมอ" เพื่อดูผล`);
  draw();
}
// ตัดสินผลของวัน: เทียบกับวิธีที่ดีที่สุด, ผ่าน/ไม่ผ่าน, คะแนน, หัวใจ
function submit() {
  if (!G.sorted || G.sent) return; G.sent = true;
  const me = G.plan.rows.find(r => r.name === G.chosen);     // ผลของวิธีที่เลือก (คำนวณไว้แล้ว และเท่ากับที่เพิ่งเล่น)
  const best = G.plan.best;
  const pass = me.P <= G.plan.limit;                       // ผ่านถ้าเวลาจัดคิวไม่เกินเกณฑ์
  // คะแนน = 100 × (ขั้นตอนของวิธีที่ดีที่สุด ÷ ขั้นตอนของคุณ) หักครั้งละ 10 ถ้าเล่นวันนี้ซ้ำ ไม่ผ่านได้ 0
  const pts = pass ? Math.max(0, Math.round(100 * Math.min(1, best.ops / me.ops)) - 10 * G.retries) : 0;
  if (!pass) G.hearts--;
  G.res = { pass, pts, me, best, over: G.hearts <= 0 };
  showResult();
}

/* ===================== PART 6: หน้าต่างผล / สรุป / ปุ่ม ===================== */

const dlg = $('#dlg');
function openDlg() { if (!dlg.open) dlg.showModal(); }
dlg.addEventListener('cancel', e => e.preventDefault());       // กัน Esc ปิดหน้าต่าง ต้องกดปุ่มในหน้าต่าง

// คำอธิบายว่าทำไมสภาพคิวแบบนี้ถึงเหมาะกับวิธีไหน (ตรวจกับการจำลองแล้ว)
const SHAPE_WHY = {
  random: 'คิวสุ่มสั้น ๆ ไม่มีผู้ชนะตายตัว ขึ้นกับว่าสุ่มได้ลำดับแบบไหน โดยรวม Selection มักถูกสุดเพราะย้ายน้อย (ไม่เกิน n−1 ครั้ง) ส่วน Bubble ต้องสลับทีละคู่จึงแพงสุด และยิ่งคิวยาวขึ้น Merge ยิ่งได้เปรียบเพราะขั้นตอนโตช้ากว่า',
  nearly: 'คิวเกือบเรียง ผิดที่แค่ 3 คู่ Insertion และ Bubble (ที่หยุดเองเมื่อไม่มีอะไรให้สลับ) แก้แค่จุดที่ผิด จึงใช้ขั้นตอนน้อยมากและใกล้เคียงกัน ส่วน Selection ต้องไล่เทียบเท่าเดิมทุกรอบ และ Merge ต้องแบ่งแล้วรวมใหม่ทั้งคิว',
  append: 'คิวเรียงแล้ว 7 คน + ผู้ป่วยใหม่ 3 คนต่อท้าย Insertion แทรกเฉพาะคนใหม่ให้เข้าที่ ส่วนที่เรียงอยู่แล้วแค่เช็กผ่าน จึงถูกสุด ส่วน Bubble, Selection และ Merge ทำงานมากกว่าอย่างชัดเจน'
};
function showResult() {
  const r = G.res, d = G.def, er = d.type === 'er', K = G.arr.length, rows = G.plan.rows;
  const title = r.pass ? 'ผ่านวันนี้' : r.over ? 'หัวใจหมดแล้ว' : 'ยังไม่ผ่าน';
  const wmax = Math.max(...r.me.waits) || 1;
  const bars = G.arr.map((k, i) => { const p = G.byK[k]; return `<div class="wb"><span>${i + 1}. ${p.name}</span><i style="width:${r.me.waits[i] / wmax * 100}%"></i><b>${r.me.waits[i].toFixed(0)}</b></div>`; }).join('');
  const verdict = r.pass ? `ใช้เวลาจัดคิว <b>${r.me.P}</b> นาที อยู่ในเกณฑ์ (≤ ${G.plan.limit}) <span class="good">ได้ ${r.pts} คะแนน</span>`
    : `ใช้เวลาจัดคิว <b>${r.me.P}</b> นาที เกินเกณฑ์ (${G.plan.limit}) <span class="bad">เสียหัวใจ 1 ดวง</span>`;
  const tail = r.pass ? `<button class="pri" data-act="next">${G.day + 1 < DAYS.length ? 'วันถัดไป' : 'ดูสรุปผล'}</button>`
    : r.over ? `<button class="pri" data-act="again">เริ่มเกมใหม่</button><button data-act="menu">กลับเมนู</button>`
      : `<button class="pri" data-act="retry">ลองวันนี้ใหม่ (−10 คะแนน)</button>`;
  $('#dbody').innerHTML = `<h2>${title}</h2><p>${d.title}<br>${verdict}</p>
    <div class="tblwrap"><table><tr><th>วิธี (เทียบทุกวิธีกับคิวเดียวกัน)</th><th>เปรียบเทียบ</th><th>ย้าย</th><th>รวมขั้นตอน</th><th>เวลาจัดคิว</th></tr>`+
    rows.map(x => `<tr class="${x === r.best ? 'best' : ''}${x.name === G.chosen ? ' you' : ''}"><td>${ALGOS[x.name].name}${x === r.best ? ' <span class="good">ดีที่สุด</span>' : ''}${x.name === G.chosen ? ' (คุณเลือก)' : ''}</td><td>${x.c}</td><td>${x.m}</td><td><b>${x.ops}</b></td><td>${x.P} นาที</td></tr>`).join('') +
    `</table></div>
    <div class="note"><b>ทำไมถึงเป็นแบบนี้</b><br>${SHAPE_WHY[d.shape]}<br>วันนี้ ${ALGOS[r.best.name].name} ใช้ ${r.best.ops} ขั้นตอน ส่วนวิธีที่คุณเลือกใช้ ${r.me.ops} ขั้นตอน</div>
    <h3>เวลารอของแต่ละคน (นาที) ตามลำดับที่เข้าตรวจ (รวมเวลาจัดคิวของคุณแล้ว)</h3><div class="wbars">${bars}</div>
    <div class="row" style="margin-top:12px">${tail}</div>`;
  openDlg();
}
function finalSummary() {
  const max = DAYS.length * 100, g = G.score >= 270 ? ['S', 'พยาบาลหัวหน้าเวรระดับตำนาน'] : G.score >= 240 ? ['A', 'จัดคิวได้เหมาะสมมาก'] : G.score >= 180 ? ['B', 'เริ่มเลือกวิธีให้เข้ากับสภาพคิวได้แล้ว'] : ['C', 'ผ่านครบทุกวัน ลองเล่นอีกรอบให้คะแนนสูงขึ้น'];
  let best = 0; try { best = +localStorage.getItem('whosNextBest') || 0; if (G.score > best) { best = G.score; localStorage.setItem('whosNextBest', best); } } catch (e) { }
  $('#dbody').innerHTML = `<h2>ชนะ! ผ่านครบ ${DAYS.length} วัน</h2>
    <div class="row"><span class="big">${g[0]}</span><div><b>${g[1]}</b><br>คะแนน ${G.score}/${max} · หัวใจเหลือ ${G.hearts}${best ? ` · สถิติสูงสุด ${best}` : ''}</div></div>
    <div class="tblwrap"><table><tr><th>วัน</th><th>สภาพคิว</th><th>วิธีที่เลือก</th><th>ดีที่สุดของวัน</th><th>คะแนน</th></tr>`+
    G.log.map(l => `<tr><td>${l.day + 1}</td><td>${l.cond}</td><td>${l.chosen}</td><td>${l.best}</td><td>${l.pts}</td></tr>`).join('') + `</table></div>
    <div class="note"><b>สิ่งที่ควรจำ</b><br>
    • การเรียงมีต้นทุน ทุกขั้นตอนทำให้ผู้ป่วยรอนานขึ้น<br>
    • คิวสุ่ม: ไม่มีผู้ชนะตายตัว Bubble แพงสุด<br>
    • คิวเกือบเรียง: Insertion และ Bubble (ที่หยุดเองได้) ถูกที่สุด<br>
    • คิวเรียงแล้วแต่มีคนใหม่ต่อท้าย: Insertion ถูกที่สุด<br>
    • ไม่มี Algorithm ที่ดีที่สุดเสมอ ต้องดูสภาพข้อมูลก่อนเลือก</div>
    <div class="row"><button class="pri" data-act="again">เล่นใหม่</button><button data-act="menu">กลับเมนู</button></div>`;
  openDlg();
}
function cheat() {
  $('#dbody').innerHTML = `<h2>ตารางสรุป Algorithm</h2>
  <div class="tblwrap"><table><tr><th>วิธี</th><th>แนวคิด</th><th>ดีสุด</th><th>แย่สุด</th></tr>
  <tr><td>Bubble</td><td>เทียบคู่ติดกัน สลับถ้าผิดลำดับ ทำซ้ำ (หยุดเองถ้าทั้งรอบไม่มีการสลับ)</td><td>O(n)</td><td>O(n²)</td></tr>
  <tr><td>Selection</td><td>หาคนที่ควรมาก่อนสุดของส่วนที่เหลือ แล้วสลับขึ้นหน้า</td><td>O(n²)</td><td>O(n²)</td></tr>
  <tr><td>Insertion</td><td>แทรกทีละคนเข้าส่วนที่เรียงแล้ว</td><td>O(n)</td><td>O(n²)</td></tr>
  <tr><td>Merge</td><td>แบ่งครึ่งซ้ำ แล้วรวมสองฝั่งที่เรียงแล้ว</td><td>O(n log n)</td><td>O(n log n)</td></tr></table></div>
  <div class="note"><b>คิดคะแนนยังไง</b><br>1 ขั้นตอน (เปรียบเทียบหรือย้าย) = ${OP_MIN} นาที ระหว่างจัดคิวผู้ป่วยทุกคนรอเพิ่ม เวลารอของผู้ป่วย = เวลาจัดคิว + เวลาตรวจของคนที่เข้าก่อนหน้า<br>
  ทุกวิธีได้ลำดับสุดท้ายเหมือนกัน ต่างกันที่จำนวนขั้นตอน คะแนนวัน = 100 × (ขั้นตอนของวิธีที่ดีที่สุด ÷ ขั้นตอนของคุณ) ผ่านวันถ้าเวลาจัดคิวไม่เกินเกณฑ์</div>
  <div class="row"><button class="pri" data-act="closeonly">ปิด</button></div>`;
  openDlg();
}

// ปุ่มในหน้าต่าง dialog

$('#dbody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const a = b.dataset.act;
  if (a === 'retry') { dlg.close(); G.retries++; loadDay(false); }
  else if (a === 'next') {
    dlg.close();
    G.score += G.res.pts; G.log.push({ day: G.day, cond: G.def.cond, chosen: ALGOS[G.chosen].name, best: ALGOS[G.res.best.name].name, pts: G.res.pts });
    G.day++; if (G.day < DAYS.length) loadDay(true); else finalSummary();
  }
  else if (a === 'again') { dlg.close(); startGame(); }
  else if (a === 'menu') { dlg.close(); G.tok++; $('#game').hidden = true; $('#menu').hidden = false; showBest(); }
  else if (a === 'closeonly') dlg.close();
});
// ปุ่มหน้าเล่น
$('#picker').addEventListener('click', e => { const b = e.target.closest('.pick'); if (b) runSort(b.dataset.k); });
$('#sendBtn').onclick = submit;
$('#skipBtn').onclick = () => { G.skip = true; };
$('#cheatBtn').onclick = $('#cheat2').onclick = cheat;
$('#startBtn').onclick = startGame;
$('#menuBtn').onclick = () => { G.tok++; G.busy = false; $('#game').hidden = true; $('#menu').hidden = false; showBest(); };
function showBest() { try { const b = +localStorage.getItem('whosNextBest') || 0; $('#bestTxt').textContent = b ? 'สถิติสูงสุด: ' + b + ' คะแนน' : ''; } catch (e) { } }
showBest();
