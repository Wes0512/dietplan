// =========================================================
// Workout A / B Seed Data — Phase 1
// 每个动作都是完整的 in-app 教学内容，不依赖外部视频即可理解
// =========================================================
import type { ExerciseStep, Workout } from '../types';

// ---------------------------------------------------------
// 共用动作库（Chair Squat / Wall Push-up 同时出现在 A 和 B，
// 只定义一次，两个 Workout 引用同一对象，避免内容不同步）
// ---------------------------------------------------------

const warmup: ExerciseStep = {
  id: 'warmup-general',
  name_en: 'General Warm-up',
  name_display: '热身 Warm-up',
  why: '让心跳和肌肉先"醒过来"，减少受伤风险，尤其你现在腰和肩颈比较紧，热身很重要。',
  start_position: '站立，双脚与肩同宽。',
  movement_steps: [
    '原地踏步 1 分钟，手臂自然摆动',
    '肩膀慢慢做 10 次向后画圈',
    '双手交握向上伸展，感受身体两侧拉伸，保持 15 秒',
    '轻轻左右转动脖子，每边 5 次（动作要慢，不要猛转）',
  ],
  reps_or_duration: '约 3 分钟',
  key_points: ['动作放慢，不追求幅度', '呼吸自然，不要憋气'],
  common_mistakes: ['直接跳过热身开始做动作', '转脖子太快太猛'],
  stop_if: ['转头/转肩时出现尖锐疼痛或头晕，立即停止并坐下休息'],
  visual_demo: {
    type: 'illustration',
    frames: [
      { label: '手臂伸展', asset_path: '/assets/exercises/warmup-frame1-reach.svg', alt_text: '简笔画：站立，手臂向上向侧伸展拉伸' },
      { label: '颈部侧倾', asset_path: '/assets/exercises/warmup-frame2-neck.svg', alt_text: '简笔画：站立，头部缓慢向一侧倾斜' },
    ],
  },
};

const cooldown: ExerciseStep = {
  id: 'cooldown-general',
  name_en: 'General Cool-down',
  name_display: '收操 Cool-down',
  why: '帮助心率慢慢降下来，放松刚刚用力的肌肉，减少隔天酸痛。',
  start_position: '站立或坐姿均可，找一个舒服的姿势。',
  movement_steps: [
    '深呼吸 5 次，每次吸气 4 秒、呼气 6 秒',
    '轻轻伸展大腿前侧：扶墙，一脚往后勾起脚跟贴臀部，保持 15-20 秒，换边',
    '肩颈再放松一次：肩膀向后画圈 5 次',
  ],
  reps_or_duration: '约 3 分钟',
  key_points: ['伸展时感觉"舒服的紧绷"就好，不要拉到痛'],
  common_mistakes: ['训练完直接坐下不收操', '伸展时用力过猛硬拉'],
  stop_if: ['伸展部位出现尖锐疼痛，立即放松回到自然姿势'],
  visual_demo: {
    type: 'illustration',
    frames: [
      { label: '深呼吸', asset_path: '/assets/exercises/cooldown-frame1-breathe.svg', alt_text: '简笔画：站立深呼吸，胸腹起伏示意' },
      { label: '扶墙拉伸', asset_path: '/assets/exercises/cooldown-frame2-stretch.svg', alt_text: '简笔画：扶墙站立，拉伸大腿前侧' },
    ],
  },
};

const chairSquat: ExerciseStep = {
  id: 'chair-squat',
  name_en: 'Chair Squat',
  name_display: '坐椅深蹲 Chair Squat',
  why: '训练大腿和臀部的力量，这两个部位是日常站起坐下、走路、上下楼梯都会用到的肌肉。对久坐的人特别有帮助。',
  start_position: '站在椅子前面，背对椅子，双脚与肩同宽，脚尖朝前或微微朝外。',
  movement_steps: [
    '想象要坐下的感觉，屁股慢慢往后往下坐',
    '膝盖方向跟脚尖一致，不要往内夹',
    '轻轻碰到椅子（不是重重坐下去）',
    '碰到椅子后立刻用大腿和臀部的力量站起来',
  ],
  reps_or_duration: '6–8 次 × 2 组',
  key_points: [
    '重心放在脚跟，不要整个人往前倒',
    '下蹲深度不需要很深，感觉舒服就好',
    '动作全程保持慢速、可控',
  ],
  common_mistakes: [
    '膝盖往内夹（内扣）',
    '整个人往前倾，脚尖没受力反而脚跟离地',
    '为了求快而"跳"坐到椅子上',
  ],
  stop_if: [
    '膝盖出现尖锐疼痛（不是酸，是刺痛）',
    '腰部疼痛明显加重',
    '感到头晕或站不稳',
  ],
  visual_demo: {
    type: 'illustration',
    frames: [
      { label: '起始姿势', asset_path: '/assets/exercises/chair-squat-frame1-start.svg', alt_text: '简笔画：站在椅子前，直立姿势' },
      { label: '动作中', asset_path: '/assets/exercises/chair-squat-frame2-mid.svg', alt_text: '简笔画：屁股向后向下坐，膝盖弯曲' },
      { label: '结束姿势', asset_path: '/assets/exercises/chair-squat-frame3-touch.svg', alt_text: '简笔画：轻触椅子后准备站起' },
    ],
  },
  external_video: {
    url: 'https://www.nhs.uk/live-well/exercise/sitting-exercises/',
    source_name: 'NHS',
    is_supplementary: true,
  },
};

const wallPushup: ExerciseStep = {
  id: 'wall-pushup',
  name_en: 'Wall Push-up',
  name_display: '墙壁伏地挺身 Wall Push-up',
  why: '用比较温和的方式训练胸部、肩膀和手臂力量，对肩颈紧绷的人来说比地板伏地挺身更安全、负担更小。',
  start_position: '面对墙壁站立，比手臂长度略远一点，双手手掌贴墙，与肩同高、与肩同宽。',
  movement_steps: [
    '身体保持一直线（不要塌腰或翘屁股）',
    '手肘弯曲，身体慢慢靠近墙壁',
    '感受胸部和手臂用力',
    '推墙把身体推回起始位置',
  ],
  reps_or_duration: '6–10 次 × 2 组',
  key_points: [
    '肩膀放松，不要耸肩（耳朵和肩膀之间要留空间）',
    '动作放慢，靠近墙壁时数 2 秒，推回去数 2 秒',
    '腰背保持自然直线',
  ],
  common_mistakes: [
    '耸肩（肩膀往耳朵方向抬）',
    '腰部往下塌，身体呈 U 字形',
    '双手位置太窄或太宽，导致肩膀不舒服',
  ],
  stop_if: [
    '肩膀出现尖锐疼痛或刺痛',
    '手腕疼痛明显',
    '颈部感到明显不适',
  ],
  visual_demo: {
    type: 'illustration',
    frames: [
      { label: '起始姿势', asset_path: '/assets/exercises/wall-pushup-frame1-start.svg', alt_text: '简笔画：面墙站立，手臂伸直撑墙，身体呈直线' },
      { label: '动作中', asset_path: '/assets/exercises/wall-pushup-frame2-lean.svg', alt_text: '简笔画：手肘弯曲，身体靠近墙壁' },
    ],
  },
  external_video: {
    url: 'https://www.nhs.uk/live-well/exercise/sitting-exercises/',
    source_name: 'NHS',
    is_supplementary: true,
  },
};

const gluteBridge: ExerciseStep = {
  id: 'glute-bridge',
  name_en: 'Glute Bridge',
  name_display: '臀桥 Glute Bridge',
  why: '强化臀部肌肉，同时温和地训练下背部周围的稳定性，对长期久坐、腰部不适的人有帮助。',
  start_position: '躺在地上（可垫瑜伽垫或毛巾），膝盖弯曲，脚掌平贴地面，双手放在身体两侧。',
  movement_steps: [
    '收紧腹部和臀部',
    '用脚掌发力，把臀部慢慢抬离地面',
    '感觉主要来自臀部而不是腰部',
    '在最高点停 1 秒，再慢慢放下臀部回到地面',
  ],
  reps_or_duration: '8–10 次 × 2 组',
  key_points: [
    '抬起时不要把腰拱得太高，身体从肩膀到膝盖呈一条斜直线就够',
    '脚掌全程贴地，不要用脚尖发力',
    '动作放慢，感受臀部而不是用甩的',
  ],
  common_mistakes: [
    '把腰过度拱起（用腰部代偿）',
    '抬得太快、太用力',
    '脚掌离地面太远（离臀部太远），导致腰部代偿更明显',
  ],
  stop_if: [
    '腰部出现尖锐疼痛（正常的臀部酸胀是可以的）',
    '出现放射到腿部的麻木或刺痛感',
  ],
  visual_demo: {
    type: 'illustration',
    frames: [
      { label: '起始姿势', asset_path: '/assets/exercises/glute-bridge-frame1-start.svg', alt_text: '简笔画：躺姿，膝盖弯曲，脚掌贴地' },
      { label: '动作中', asset_path: '/assets/exercises/glute-bridge-frame2-mid.svg', alt_text: '简笔画：臀部开始向上抬起' },
      { label: '结束姿势', asset_path: '/assets/exercises/glute-bridge-frame3-top.svg', alt_text: '简笔画：臀部完全抬起，肩到膝呈斜直线' },
    ],
  },
  external_video: {
    url: 'https://www.nhs.uk/live-well/exercise/sitting-exercises/',
    source_name: 'NHS',
    is_supplementary: true,
  },
};

const birdDog: ExerciseStep = {
  id: 'bird-dog',
  name_en: 'Bird Dog',
  name_display: '鸟狗式 Bird Dog',
  why: '训练核心稳定性和平衡感，同时不会给腰部太大压力，是很多物理治疗师会用来改善腰痛的基础动作。',
  start_position: '四点跪姿：双手在肩膀正下方，膝盖在髋部正下方，背部保持自然平直（不拱不塌）。',
  movement_steps: [
    '收紧腹部，保持骨盆稳定不晃动',
    '同时伸出一只手臂（往前）和对侧的腿（往后）',
    '伸到自己觉得稳定、不晃的幅度就好，不需要伸到最直',
    '保持 1-2 秒，慢慢收回到起始姿势',
    '换另一侧手脚重复',
  ],
  reps_or_duration: '每边 5–6 次 × 2 组',
  key_points: [
    '宁愿幅度小一点但身体不晃，也不要为了伸直而晃动',
    '腰部不要跟着扭转，想象背上放了一杯水，尽量不洒出来',
    '呼吸自然，不要憋气',
  ],
  common_mistakes: [
    '身体左右晃动或扭腰来"凑"角度',
    '腰部往下塌陷',
    '为了伸直手脚而牺牲平衡',
  ],
  stop_if: [
    '腰部出现尖锐疼痛',
    '完全无法保持平衡、身体明显晃动',
  ],
  visual_demo: {
    type: 'illustration',
    frames: [
      { label: '四点跪姿', asset_path: '/assets/exercises/bird-dog-frame1-start.svg', alt_text: '简笔画：四点跪姿，背部平直' },
      { label: '伸展中', asset_path: '/assets/exercises/bird-dog-frame2-extend.svg', alt_text: '简笔画：对侧手臂与腿同时向外伸展中' },
      { label: '保持伸展', asset_path: '/assets/exercises/bird-dog-frame3-hold.svg', alt_text: '简笔画：对侧手臂与腿完全伸展，保持水平' },
    ],
  },
  external_video: {
    url: 'https://www.nhs.uk/live-well/exercise/sitting-exercises/',
    source_name: 'NHS',
    is_supplementary: true,
  },
};

// ---------------------------------------------------------
// Workout A
// ---------------------------------------------------------
export const workoutA: Workout = {
  id: 'workout-a',
  name: '训练 A',
  description: '入门全身训练，重点是大腿、臀部和上肢基础力量，动作全部低冲击、可在家完成、不需要任何器材。',
  duration_min_range: [15, 20],
  level: 'beginner',
  warmup,
  exercises: [chairSquat, wallPushup, gluteBridge],
  cooldown,
  safety_notes:
    '如果腰部、脚板或膝盖出现明显不适，请先减少次数或缩小动作幅度，而不是硬撑完成组数。任何尖锐疼痛、麻木、刺痛、头晕或胸痛，请立即停止训练。',
};

// ---------------------------------------------------------
// Workout B
// ---------------------------------------------------------
export const workoutB: Workout = {
  id: 'workout-b',
  name: '训练 B',
  description: '加入核心稳定训练（鸟狗式），搭配基础下肢与上肢动作，重点放在动作质量而不是速度。',
  duration_min_range: [15, 20],
  level: 'beginner',
  warmup,
  exercises: [birdDog, chairSquat, wallPushup],
  cooldown,
  safety_notes:
    '鸟狗式如果感觉腰部代偿明显，可以先缩小手脚伸出的幅度，甚至只做"手臂伸出"或"腿伸出"其中一边。任何尖锐疼痛、麻木、刺痛、头晕或胸痛，请立即停止训练。',
};

export const seedWorkouts: Workout[] = [workoutA, workoutB];
