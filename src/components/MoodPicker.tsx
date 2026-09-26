import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  energyEmoji,
  getMoodLog,
  moodEmoji,
  moodLevels,
  saveMoodLog,
} from '@/modules/productivity';
import type { IsoDate } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { minTouchSize, useTheme } from '@/shared/theme';
import { AppText, Card, showError, TextField } from '@/shared/ui';

/**
 * Humeur et énergie du jour, de 1 à 5, avec une note facultative.
 * Enregistré dès que les deux sont choisis (et à chaque changement).
 */
export function MoodPicker({ date }: { date: IsoDate }) {
  const { t } = useTranslation();
  const db = useDb();
  const { colors, radius, spacing } = useTheme();
  const saved = useLiveQuery((d) => getMoodLog(d, date), ['mood_logs'], [date]);
  // Ce que l'étudiant vient de choisir ; sinon, ce qui est enregistré pour ce jour.
  type Draft = { mood: number | null; energy: number | null; note: string };
  const [draft, setDraft] = useState<Draft | null>(null);
  const current: Draft = draft ?? {
    mood: saved.data?.mood ?? null,
    energy: saved.data?.energy ?? null,
    note: saved.data?.note ?? '',
  };
  const { mood, energy, note } = current;
  const change = (patch: Partial<Draft>) => setDraft({ ...current, ...patch });

  const save = (m: number | null, e: number | null, n: string) => {
    if (m === null || e === null) return;
    saveMoodLog(db, { date, mood: m, energy: e, note: n }).catch((err: unknown) =>
      showError(userMessageKey(err)),
    );
  };

  const row = (
    label: string,
    value: number | null,
    emoji: Record<number, string>,
    names: string,
    onPick: (v: number) => void,
  ) => (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="bodyStrong">{label}</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {moodLevels.map((v) => {
          const selected = v === value;
          return (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`${names}.${v}`)}
              onPress={() => onPick(v)}
              style={{
                flex: 1,
                minHeight: minTouchSize + 4,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primarySoft : colors.surface,
              }}
            >
              <AppText style={{ fontSize: 24, lineHeight: 30 }}>{emoji[v]}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        {row(t('mood.moodLabel'), mood, moodEmoji, 'mood.levels', (v) => {
          change({ mood: v });
          save(v, energy, note);
        })}
        {row(t('mood.energyLabel'), energy, energyEmoji, 'mood.energyLevels', (v) => {
          change({ energy: v });
          save(mood, v, note);
        })}
        {mood !== null && energy !== null ? (
          <TextField
            label={t('mood.note')}
            value={note}
            onChangeText={(v) => change({ note: v })}
            onEndEditing={() => save(mood, energy, note)}
            placeholder={t('common.optional')}
            maxLength={500}
            multiline
          />
        ) : (
          <AppText variant="caption" color="muted">
            {t('mood.pickBoth')}
          </AppText>
        )}
      </View>
    </Card>
  );
}
