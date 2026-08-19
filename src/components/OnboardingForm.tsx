// =========================================================
// Onboarding Form — 第一次使用的空状态（Phase 3, 需求点 #19）
// Phase 6.5：UI 文案改为简体中文
// =========================================================
import { useState } from 'react';
import { userRepo } from '../repositories/userRepo';
import { todayDateString } from '../services/dateEngine';
import { copy } from '../i18n';
import type { User } from '../types';

interface OnboardingFormProps {
  onComplete: (user: User) => void;
}

export function OnboardingForm({ onComplete }: OnboardingFormProps) {
  const c = copy.onboarding;
  const [name, setName] = useState('');
  const [age, setAge] = useState(26);
  const [heightCm, setHeightCm] = useState(165);
  const [weightKg, setWeightKg] = useState(66);
  const [targetKg, setTargetKg] = useState(62);
  const [baselineSteps, setBaselineSteps] = useState(6300);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);

    if (!name.trim()) {
      setError(c.nameRequired);
      return;
    }
    setSubmitting(true);
    try {
      const user = await userRepo.create({
        name: name.trim(),
        age,
        gender: 'male',
        height_cm: heightCm,
        starting_weight_kg: weightKg,
        target_weight_kg: targetKg,
        baseline_steps: baselineSteps,
        program_start_date: todayDateString(),
      });
      onComplete(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : c.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-semibold">{c.title}</h1>
      <p className="text-sm text-gray-500 mt-1">{c.subtitle}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-gray-700">{c.name}</span>
          <input
            className="mt-1 w-full border rounded-lg px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-700">{c.age}</span>
          <input
            type="number"
            className="mt-1 w-full border rounded-lg px-3 py-2"
            value={age}
            onChange={(e) => setAge(Number(e.target.value))}
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-700">{c.height}</span>
          <input
            type="number"
            className="mt-1 w-full border rounded-lg px-3 py-2"
            value={heightCm}
            onChange={(e) => setHeightCm(Number(e.target.value))}
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-700">{c.currentWeight}</span>
          <input
            type="number"
            step="0.1"
            className="mt-1 w-full border rounded-lg px-3 py-2"
            value={weightKg}
            onChange={(e) => setWeightKg(Number(e.target.value))}
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-700">{c.firstPhaseTarget}</span>
          <input
            type="number"
            step="0.1"
            className="mt-1 w-full border rounded-lg px-3 py-2"
            value={targetKg}
            onChange={(e) => setTargetKg(Number(e.target.value))}
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-700">{c.baselineSteps}</span>
          <input
            type="number"
            className="mt-1 w-full border rounded-lg px-3 py-2"
            value={baselineSteps}
            onChange={(e) => setBaselineSteps(Number(e.target.value))}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-black text-white rounded-lg py-3 font-medium disabled:opacity-50"
        >
          {submitting ? c.submitting : c.submit}
        </button>
      </form>
    </div>
  );
}
