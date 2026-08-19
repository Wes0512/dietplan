// =========================================================
// QuickCheckIn — Today 页面核心记录表单（Phase 3）
// 需求点 5–17：weight/steps/water/sleep/energy/food/lunch_walk/
// shoulder_relax/sitting_breaks/workout/exercise_feedback/pain/save confirm
//
// 设计原则：Progressive disclosure —— 用 <details> 折叠区块，
// 一次只展开一个动作，不会让用户一打开就看到所有字段。
// 每个区块保存后各自显示"已保存 ✓"，不需要一个全局大 Save 按钮。
//
// Phase 6.5：UI 文案改为简体中文，数据库字段名 / 内部变量名不变。
// =========================================================
import { useState } from 'react';
import { dailyLogRepo } from '../repositories/dailyLogRepo';
import { workoutSessionRepo } from '../repositories/workoutRepo';
import { computeSleepDurationMin, formatDuration, validateSleepDuration, type SleepValidation } from '../services/sleepValidation';
import { SaveIndicator, useSaveIndicator } from './SaveIndicator';
import { copy } from '../i18n';
import type {
  DailyLog,
  DrinkType,
  ExerciseFeeling,
  PainArea,
  PortionSize,
  QualityLevel,
  SnackLevel,
  Workout,
} from '../types';

interface QuickCheckInProps {
  user_id: string;
  date: string;
  plannedDayNumber: number;
  log: DailyLog | undefined;
  requiredWorkout: Workout | undefined; // undefined = 今天没有正式训练（rest/recovery day）
  onChange: (updated: DailyLog) => void;
}

const c = copy.checkIn;

const PAIN_AREAS: { value: PainArea; label: string }[] = [
  { value: 'lower_back', label: c.painLowerBack },
  { value: 'foot', label: c.painFoot },
  { value: 'knee', label: c.painKnee },
  { value: 'shoulder_neck', label: c.painShoulderNeck },
  { value: 'other', label: c.painOther },
];

export function QuickCheckIn({ user_id, date, plannedDayNumber, log, requiredWorkout, onChange }: QuickCheckInProps) {
  async function save(patch: Partial<DailyLog>) {
    const updated = await dailyLogRepo.save(user_id, date, patch);
    onChange(updated);
    return updated;
  }

  return (
    <div className="mt-4 divide-y border-t border-b">
      <WeightSection log={log} onSave={save} />
      <StepsSection log={log} onSave={save} />
      <WaterSection user_id={user_id} date={date} log={log} onChange={onChange} />
      <SleepSection log={log} onSave={save} />
      <EnergySection log={log} onSave={save} />
      <FoodSection log={log} onSave={save} />
      <LunchWalkSection log={log} onSave={save} />
      <ShoulderRelaxSection log={log} onSave={save} />
      <SittingBreaksSection user_id={user_id} date={date} log={log} onChange={onChange} />
      <WorkoutSection
        user_id={user_id}
        date={date}
        plannedDayNumber={plannedDayNumber}
        log={log}
        workout={requiredWorkout}
        onChange={onChange}
      />
    </div>
  );
}

// ---------------------------------------------------------
// 小工具：折叠区块外壳
// ---------------------------------------------------------
function Section({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="py-3 px-4" open={defaultOpen}>
      <summary className="flex items-center justify-between cursor-pointer text-sm font-medium">
        <span>{title}</span>
        {summary && <span className="text-xs text-gray-400 font-normal">{summary}</span>}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

// ---------------------------------------------------------
// 5. Weight
// ---------------------------------------------------------
function WeightSection({ log, onSave }: { log: DailyLog | undefined; onSave: (p: Partial<DailyLog>) => Promise<DailyLog> }) {
  const [value, setValue] = useState(log?.weight_kg?.toString() ?? '');
  const { visible, flash } = useSaveIndicator();

  async function handleBlur() {
    const num = Number(value);
    if (!value || !Number.isFinite(num)) return;
    await onSave({ weight_kg: num });
    flash();
  }

  return (
    <Section title={c.weight} summary={log?.weight_kg ? `${log.weight_kg} ${c.weightUnit}` : undefined}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          className="border rounded-lg px-3 py-2 w-28"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          placeholder="kg"
        />
        <SaveIndicator visible={visible} />
      </div>
    </Section>
  );
}

// ---------------------------------------------------------
// 6. Steps
// ---------------------------------------------------------
function StepsSection({ log, onSave }: { log: DailyLog | undefined; onSave: (p: Partial<DailyLog>) => Promise<DailyLog> }) {
  const [value, setValue] = useState(log?.steps?.toString() ?? '');
  const { visible, flash } = useSaveIndicator();

  async function handleBlur() {
    const num = Number(value);
    if (!value || !Number.isFinite(num)) return;
    await onSave({ steps: num });
    flash();
  }

  return (
    <Section title={`${c.steps}${c.stepsSource}`} summary={log?.steps ? log.steps.toLocaleString() : undefined}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          className="border rounded-lg px-3 py-2 w-28"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          placeholder="步数"
        />
        <SaveIndicator visible={visible} />
      </div>
    </Section>
  );
}

// ---------------------------------------------------------
// 7. Water quick-add
// ---------------------------------------------------------
function WaterSection({
  user_id,
  date,
  log,
  onChange,
}: {
  user_id: string;
  date: string;
  log: DailyLog | undefined;
  onChange: (updated: DailyLog) => void;
}) {
  const { visible, flash } = useSaveIndicator();

  async function add(amount: number) {
    const updated = await dailyLogRepo.addWater(user_id, date, amount);
    onChange(updated);
    flash();
  }

  return (
    <Section title={c.water} summary={`${log?.water_ml ?? 0} ml`}>
      <div className="flex items-center gap-2">
        {[250, 500, 750].map((amount) => (
          <button
            key={amount}
            onClick={() => add(amount)}
            className="rounded-full border px-3 py-1.5 text-sm"
          >
            +{amount} ml
          </button>
        ))}
        <SaveIndicator visible={visible} />
      </div>
    </Section>
  );
}

// ---------------------------------------------------------
// 8. Sleep
// ---------------------------------------------------------
function SleepSection({ log, onSave }: { log: DailyLog | undefined; onSave: (p: Partial<DailyLog>) => Promise<DailyLog> }) {
  const [start, setStart] = useState(log?.sleep_start ?? '');
  const [end, setEnd] = useState(log?.sleep_end ?? '');
  const [pending, setPending] = useState<SleepValidation | undefined>();
  const { visible, flash } = useSaveIndicator();
  const sv = copy.sleepValidation;

  async function commit(duration: number) {
    await onSave({ sleep_start: start, sleep_end: end, sleep_duration_min: duration });
    setPending(undefined);
    flash();
  }

  function handleSaveClick() {
    if (!start || !end) return;
    const duration = computeSleepDurationMin(start, end);
    const validation = validateSleepDuration(duration);

    if (validation.status === 'ok') {
      commit(duration);
      return;
    }
    // needs_confirmation / too_long：都不直接保存，先展示中性的确认提示
    setPending(validation);
  }

  return (
    <Section
      title={c.sleep}
      summary={log?.sleep_duration_min ? formatDuration(log.sleep_duration_min) : undefined}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-sm text-gray-600">
          {c.sleptAt}
          <input
            type="time"
            className="ml-2 border rounded-lg px-2 py-1"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              setPending(undefined);
            }}
          />
        </label>
        <label className="text-sm text-gray-600">
          {c.wokeAt}
          <input
            type="time"
            className="ml-2 border rounded-lg px-2 py-1"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setPending(undefined);
            }}
          />
        </label>
        <button onClick={handleSaveClick} className="rounded-md bg-black text-white text-sm px-3 py-1.5">
          {c.save}
        </button>
        <SaveIndicator visible={visible} />
      </div>

      {pending?.status === 'needs_confirmation' && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{sv.needsConfirmationMessage(formatDuration(pending.duration_min))}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => commit(pending.duration_min)}
              className="rounded-md bg-amber-900 text-white text-sm px-3 py-1.5"
            >
              {sv.confirmCorrect}
            </button>
            <button
              onClick={() => setPending(undefined)}
              className="rounded-md border border-amber-300 text-amber-900 text-sm px-3 py-1.5"
            >
              {sv.letMeFix}
            </button>
          </div>
        </div>
      )}

      {pending?.status === 'too_long' && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p>{sv.tooLongMessage(formatDuration(pending.duration_min))}</p>
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------
// 9. Afternoon energy
// ---------------------------------------------------------
function EnergySection({ log, onSave }: { log: DailyLog | undefined; onSave: (p: Partial<DailyLog>) => Promise<DailyLog> }) {
  const { visible, flash } = useSaveIndicator();

  async function pick(value: 1 | 2 | 3 | 4 | 5) {
    await onSave({ afternoon_energy: value });
    flash();
  }

  return (
    <Section title={c.energy} summary={log?.afternoon_energy ? `${log.afternoon_energy}/5` : undefined}>
      <div className="flex items-center gap-2">
        {([1, 2, 3, 4, 5] as const).map((v) => (
          <button
            key={v}
            onClick={() => pick(v)}
            className={`w-9 h-9 rounded-full border text-sm ${log?.afternoon_energy === v ? 'bg-black text-white' : ''}`}
          >
            {v}
          </button>
        ))}
        <SaveIndicator visible={visible} />
      </div>
      <p className="text-xs text-gray-400 mt-1">{c.energyHint}</p>
    </Section>
  );
}

// ---------------------------------------------------------
// 10. Food portion tracking
// ---------------------------------------------------------
const PORTION_LABEL: Record<PortionSize, string> = {
  small: c.portionSmall,
  normal: c.portionNormal,
  large: c.portionLarge,
};

const QUALITY_LABEL: Record<QualityLevel, string> = {
  low: c.qualityLow,
  enough: c.qualityEnough,
};

const SNACK_LABEL: Record<SnackLevel, string> = {
  none: c.snacksNone,
  small: c.snacksSmall,
  high: c.snacksHigh,
};

const DRINK_LABEL: Record<DrinkType, string> = {
  water: c.drinkWater,
  sugar_free: c.drinkSugarFree,
  sugary: c.drinkSugary,
};

function PortionPicker({
  label,
  value,
  onPick,
}: {
  label: string;
  value: PortionSize | undefined;
  onPick: (v: PortionSize) => void;
}) {
  return (
    <div className="mb-2">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="flex gap-2">
        {(['small', 'normal', 'large'] as const).map((v) => (
          <button
            key={v}
            onClick={() => onPick(v)}
            className={`rounded-full border px-3 py-1 text-sm ${value === v ? 'bg-black text-white' : ''}`}
          >
            {PORTION_LABEL[v]}
          </button>
        ))}
      </div>
    </div>
  );
}

function TwoLevelPicker<T extends string>({
  label,
  options,
  value,
  onPick,
  labelMap,
}: {
  label: string;
  options: readonly T[];
  value: T | undefined;
  onPick: (v: T) => void;
  labelMap: Record<T, string>;
}) {
  return (
    <div className="mb-2">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="flex gap-2">
        {options.map((v) => (
          <button
            key={v}
            onClick={() => onPick(v)}
            className={`rounded-full border px-3 py-1 text-sm ${value === v ? 'bg-black text-white' : ''}`}
          >
            {labelMap[v]}
          </button>
        ))}
      </div>
    </div>
  );
}

function FoodSection({ log, onSave }: { log: DailyLog | undefined; onSave: (p: Partial<DailyLog>) => Promise<DailyLog> }) {
  const { visible, flash } = useSaveIndicator();
  const drinks = log?.drinks ?? [];

  async function patch(p: Partial<DailyLog>) {
    await onSave(p);
    flash();
  }

  function toggleDrink(d: DrinkType) {
    const next = drinks.includes(d) ? drinks.filter((x) => x !== d) : [...drinks, d];
    patch({ drinks: next });
  }

  return (
    <Section title={c.food}>
      <PortionPicker label={c.breakfast} value={log?.breakfast_portion} onPick={(v) => patch({ breakfast_portion: v })} />
      <PortionPicker label={c.lunch} value={log?.lunch_portion} onPick={(v) => patch({ lunch_portion: v })} />
      <PortionPicker label={c.dinner} value={log?.dinner_portion} onPick={(v) => patch({ dinner_portion: v })} />
      <TwoLevelPicker<QualityLevel>
        label={c.protein}
        options={['low', 'enough']}
        value={log?.protein}
        onPick={(v) => patch({ protein: v })}
        labelMap={QUALITY_LABEL}
      />
      <TwoLevelPicker<QualityLevel>
        label={c.vegetables}
        options={['low', 'enough']}
        value={log?.vegetables}
        onPick={(v) => patch({ vegetables: v })}
        labelMap={QUALITY_LABEL}
      />
      <TwoLevelPicker<SnackLevel>
        label={c.snacks}
        options={['none', 'small', 'high']}
        value={log?.snacks}
        onPick={(v) => patch({ snacks: v })}
        labelMap={SNACK_LABEL}
      />
      <div className="mb-1">
        <div className="text-xs text-gray-500 mb-1">{c.drinks}（{c.drinksHint}）</div>
        <div className="flex gap-2">
          {(['water', 'sugar_free', 'sugary'] as const).map((d) => (
            <button
              key={d}
              onClick={() => toggleDrink(d)}
              className={`rounded-full border px-3 py-1 text-sm ${drinks.includes(d) ? 'bg-black text-white' : ''}`}
            >
              {DRINK_LABEL[d]}
            </button>
          ))}
        </div>
      </div>
      <SaveIndicator visible={visible} />
    </Section>
  );
}

// ---------------------------------------------------------
// 11. Lunch walk
// ---------------------------------------------------------
function LunchWalkSection({ log, onSave }: { log: DailyLog | undefined; onSave: (p: Partial<DailyLog>) => Promise<DailyLog> }) {
  const { visible, flash } = useSaveIndicator();
  const done = log?.lunch_walk_done ?? false;

  async function toggle() {
    await onSave({ lunch_walk_done: !done });
    flash();
  }

  return (
    <Section title={`${c.lunchWalk}${c.lunchWalkDuration}`} summary={done ? copy.goalStatus.completed : undefined}>
      <button onClick={toggle} className={`rounded-md border px-4 py-2 text-sm ${done ? 'bg-green-600 text-white border-green-600' : ''}`}>
        {done ? `☑ ${c.markDone}` : `☐ ${c.markDone}`}
      </button>
      <SaveIndicator visible={visible} />
    </Section>
  );
}

// ---------------------------------------------------------
// 12. Shoulder / Neck relax
// ---------------------------------------------------------
function ShoulderRelaxSection({ log, onSave }: { log: DailyLog | undefined; onSave: (p: Partial<DailyLog>) => Promise<DailyLog> }) {
  const { visible, flash } = useSaveIndicator();
  const done = log?.shoulder_relax_done ?? false;

  async function toggle() {
    await onSave({ shoulder_relax_done: !done });
    flash();
  }

  return (
    <Section title={`${c.shoulderRelax}${c.shoulderRelaxDuration}`} summary={done ? copy.goalStatus.completed : undefined}>
      <button onClick={toggle} className={`rounded-md border px-4 py-2 text-sm ${done ? 'bg-green-600 text-white border-green-600' : ''}`}>
        {done ? `☑ ${c.markDone}` : `☐ ${c.markDone}`}
      </button>
      <SaveIndicator visible={visible} />
    </Section>
  );
}

// ---------------------------------------------------------
// 13. Sitting breaks
// ---------------------------------------------------------
function SittingBreaksSection({
  user_id,
  date,
  log,
  onChange,
}: {
  user_id: string;
  date: string;
  log: DailyLog | undefined;
  onChange: (updated: DailyLog) => void;
}) {
  const { visible, flash } = useSaveIndicator();
  const count = log?.sitting_breaks ?? 0;

  async function increment() {
    const updated = await dailyLogRepo.incrementSittingBreak(user_id, date);
    onChange(updated);
    flash();
  }

  return (
    <Section title={c.sittingBreaks} summary={c.sittingBreaksToday(count)}>
      <button onClick={increment} className="rounded-md border px-4 py-2 text-sm">
        {c.sittingBreaksButton}
      </button>
      <SaveIndicator visible={visible} />
    </Section>
  );
}

// ---------------------------------------------------------
// 14–16. Workout status + exercise feedback + pain feedback
// ---------------------------------------------------------
const FEELING_LABEL: Record<ExerciseFeeling, string> = {
  comfortable: c.feelingComfortable,
  tired: c.feelingTired,
  uncomfortable: c.feelingUncomfortable,
};

function WorkoutSection({
  user_id,
  date,
  plannedDayNumber,
  log,
  workout,
  onChange,
}: {
  user_id: string;
  date: string;
  plannedDayNumber: number;
  log: DailyLog | undefined;
  workout: Workout | undefined;
  onChange: (updated: DailyLog) => void;
}) {
  const { visible, flash } = useSaveIndicator();
  const [feeling, setFeeling] = useState<ExerciseFeeling | undefined>(log?.exercise_feeling);
  const [pain, setPain] = useState<PainArea[]>(log?.pain_area ?? []);
  const [showFeelingPicker, setShowFeelingPicker] = useState(false);

  if (!workout) {
    return (
      <Section title={c.todayWorkoutHeading} summary={c.noWorkoutToday}>
        <p className="text-sm text-gray-500">{c.noWorkoutHint}</p>
      </Section>
    );
  }

  const completed = log?.exercise_completed && log.exercise_type === workout.id.replace(/-/g, '_');
  const currentWorkout = workout; // 稳定引用，避免嵌套闭包里 TS 无法窄化 undefined

  function togglePain(area: PainArea) {
    setPain((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  }

  async function confirmFeeling(f: ExerciseFeeling) {
    setFeeling(f);
    const updated = await workoutSessionRepo.completeWorkout({
      user_id,
      date,
      workout_id: currentWorkout.id,
      planned_day_number: plannedDayNumber,
      feeling: f,
      pain_area: f === 'uncomfortable' ? pain : undefined,
    });
    onChange(updated.log);
    flash();
    if (f !== 'uncomfortable') setShowFeelingPicker(false);
  }

  return (
    <Section
      title={c.todayWorkoutTitle(workout.name)}
      summary={completed ? c.workoutCompleted : c.workoutRequired}
      defaultOpen
    >
      {completed ? (
        <div className="text-sm text-green-700">
          {c.completedFeelingText(log?.exercise_feeling ? FEELING_LABEL[log.exercise_feeling] : c.feelingNotRecorded)}
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-2">
            {c.workoutDurationExercises(workout.duration_min_range[0], workout.duration_min_range[1], workout.exercises.length)}
          </p>
          {!showFeelingPicker ? (
            <button
              onClick={() => setShowFeelingPicker(true)}
              className="rounded-md bg-black text-white text-sm px-4 py-2"
            >
              {c.markWorkoutDone}
            </button>
          ) : (
            <div>
              <p className="text-sm mb-2">{c.howDoYouFeel}</p>
              <div className="flex gap-2 mb-2">
                {(['comfortable', 'tired', 'uncomfortable'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      // Phase 9 修复：选择"不太舒服"时只先展开疼痛部位选择器，
                      // 不立刻写入数据——避免在用户还没选完疼痛部位时就
                      // 提前保存一条 pain_area 为空的 WorkoutSession，
                      // 等用户点"确认"才真正写入，防止产生重复/不完整的记录。
                      setFeeling(f);
                      if (f !== 'uncomfortable') {
                        confirmFeeling(f);
                      }
                    }}
                    className={`rounded-full border px-3 py-1.5 text-sm ${feeling === f ? 'bg-black text-white' : ''}`}
                  >
                    {FEELING_LABEL[f]}
                  </button>
                ))}
              </div>
              {feeling === 'uncomfortable' && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">{c.painWhere}</p>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {PAIN_AREAS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => togglePain(p.value)}
                        className={`rounded-full border px-3 py-1 text-sm ${pain.includes(p.value) ? 'bg-red-600 text-white border-red-600' : ''}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => confirmFeeling('uncomfortable')}
                    className="rounded-md bg-black text-white text-sm px-4 py-2"
                  >
                    {c.confirmFeeling}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <SaveIndicator visible={visible} />
    </Section>
  );
}
