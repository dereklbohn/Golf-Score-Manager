import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '../screens/FirebaseConfig';
import { validGameDate, validStrokes } from '../utils/gameValidation';

type Scan = { course: string; notes: string; players: { name: string; holes: (number | null)[]; total: number | null }[] };
type Row = { name: string; holes: string[]; total: string; memberId: string };
type Member = { id: string; name: string };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const normalize = (value: string) => value.trim().toLocaleLowerCase();

export default function ScorecardReview({ userId, photoUri, image, onDone, onRetake }: {
  userId: string; photoUri: string; image: string; onDone: () => void; onRetake: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [course, setCourse] = useState('');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const gameRef = useRef(doc(collection(db, 'teams', userId, 'games')));
  const newMemberIds = useRef<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [result, roster] = await Promise.all([
          httpsCallable<{ image: string }, Scan>(getFunctions(app, 'us-central1'), 'scanScorecard', { timeout: 90000 })({ image }),
          getDocs(collection(db, 'teams', userId, 'members')),
        ]);
        if (!active) return;
        const list = roster.docs.map((item) => ({ id: item.id, name: item.data().name as string }));
        setMembers(list); setCourse(result.data.course); setNotes(result.data.notes);
        setRows(result.data.players.map((player) => {
          const matches = list.filter((member) => normalize(member.name) === normalize(player.name));
          return { name: player.name, holes: player.holes.map((score) => score === null ? '' : String(score)), total: player.total === null ? '' : String(player.total), memberId: matches.length === 1 ? matches[0].id : '' };
        }));
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Could not scan. Please retry.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [image, userId, attempt]);
  const update = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row));
  const save = async () => {
    if (lock.current) return;
    setError('');
    if (!course.trim() || course.trim().length > 100 || !validGameDate(date) || date > today()) return setError('Enter a course and a valid date, today or earlier.');
    if (!rows.length || rows.some((row) => !row.name.trim() || row.name.trim().length > 80 || !validStrokes(row.total) || row.holes.some((score) => score !== '' && (!/^\d{1,2}$/.test(score) || Number(score) < 1)))) return setError('Check every player name, total (1�999), and hole score (1�99). Leave unreadable holes blank.');
    const identities = rows.map((row) => row.memberId || normalize(row.name));
    if (new Set(identities).size !== identities.length || new Set(rows.map((row) => normalize(row.name))).size !== rows.length) return setError('Each player can appear only once. Remove duplicate rows or select distinct players.');
    if (members.length + rows.filter((row) => !row.memberId).length > 50) return setError('Your team can have up to 50 players. Match existing players or remove rows.');
    lock.current = true; setSaving(true);
    try {
      const batch = writeBatch(db);
      const players = rows.map((row) => {
        const existing = members.find((member) => member.id === row.memberId);
        const key = normalize(row.name);
        if (!existing && !newMemberIds.current[key]) newMemberIds.current[key] = doc(collection(db, 'teams', userId, 'members')).id;
        const memberId = existing?.id || newMemberIds.current[key];
        if (!existing) batch.set(doc(db, 'teams', userId, 'members', memberId), { name: row.name.trim(), createdAt: serverTimestamp() });
        return { memberId, name: existing?.name || row.name.trim(), strokes: Number(row.total), holes: row.holes.map((score) => score === '' ? null : Number(score)) };
      });
      batch.set(gameRef.current, { course: course.trim(), playedOn: date, players, createdAt: serverTimestamp() });
      await batch.commit(); onDone();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed. Your edits are still here.'); }
    finally { lock.current = false; setSaving(false); }
  };

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Does this look right?</Text>
      <Image source={{ uri: photoUri }} style={styles.photo} />
      {loading ? <><ActivityIndicator color="#176B45" /><Text>Reading names and handwritten scores�</Text></> : <>
        <Text>Review every name and score against the photo. Nothing is saved until you confirm. Photos are sent to Google for recognition.</Text>
        {!!notes && <Text style={styles.notice}>{notes}</Text>}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <ReviewButton disabled={saving} label="Retry recognition" onPress={() => { setLoading(true); setError(''); setAttempt((value) => value + 1); }} />
        <Text>Course</Text><TextInput accessibilityLabel="Scanned course" style={styles.input} value={course} onChangeText={setCourse} editable={!saving} maxLength={100} />
        <Text>Date played (YYYY-MM-DD)</Text><TextInput accessibilityLabel="Scanned game date" style={styles.input} value={date} onChangeText={setDate} editable={!saving} maxLength={10} />
        {!rows.length && <Text>No scored player rows found. Retake a completed card or add players manually.</Text>}
        {rows.map((row, index) => {
          const holeSum = row.holes.reduce((sum, value) => sum + Number(value || 0), 0);
          return <View style={styles.card} key={index}>
            <Text style={styles.heading}>Player {index + 1}</Text>
            <TextInput accessibilityLabel={`Player ${index + 1} name`} style={styles.input} value={row.name} editable={!saving} maxLength={80} onChangeText={(name) => {
              const matches = members.filter((member) => normalize(member.name) === normalize(name));
              update(index, { name, memberId: matches.length === 1 ? matches[0].id : '' });
            }} />
            <Text>{row.memberId ? 'Matched to existing player' : 'Will create a new player. Choose an existing name below if this is a handwriting error.'}</Text>
            <ScrollView horizontal>{members.map((member) => <TouchableOpacity key={member.id} disabled={saving} style={styles.choice} onPress={() => update(index, { memberId: member.id, name: member.name })}><Text>{member.name}{row.memberId === member.id ? ' ?' : ''}</Text></TouchableOpacity>)}</ScrollView>
            <View style={styles.holes}>{row.holes.map((score, hole) => <View style={styles.hole} key={hole}><Text>{hole + 1}</Text><TextInput accessibilityLabel={`${row.name || `Player ${index + 1}`} hole ${hole + 1}`} style={styles.input} keyboardType="number-pad" maxLength={2} value={score} editable={!saving} onChangeText={(value) => update(index, { holes: row.holes.map((old, i) => i === hole ? value : old) })} /></View>)}</View>
            <Text>Total gross strokes for holes played</Text><TextInput accessibilityLabel={`Player ${index + 1} total strokes`} style={styles.input} keyboardType="number-pad" maxLength={3} value={row.total} onChangeText={(total) => update(index, { total })} editable={!saving} />
            <Text>{row.holes.filter(Boolean).length} holes transcribed � sum {holeSum}</Text>
            {Number(row.total) !== holeSum && <Text style={styles.notice}>Total differs from the transcribed holes. Check for missing holes, net scores, or handwriting errors before confirming.</Text>}
            <ReviewButton disabled={saving} label="Use sum of entered holes" onPress={() => update(index, { total: String(holeSum) })} />
            <ReviewButton disabled={saving} label="Remove player" onPress={() => setRows((current) => current.filter((_, i) => i !== index))} />
          </View>;
        })}
        {rows.length < 12 && <ReviewButton disabled={saving} label="Add player" onPress={() => setRows((current) => [...current, { name: '', memberId: '', holes: Array(18).fill(''), total: '' }])} />}
        <ReviewButton disabled={saving} label={saving ? "Saving..." : "Yes, confirm and save scores"} onPress={save} />
      </>}
      <ReviewButton disabled={saving} label="Retake photo" onPress={onRetake} />
      <ReviewButton disabled={saving} label="Cancel and return to dashboard" onPress={onDone} />
    </ScrollView>
  </KeyboardAvoidingView>;
}
function ReviewButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} style={[styles.button, disabled && { opacity: 0.5 }]} onPress={onPress}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
}
const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, paddingBottom: 48 }, heading: { fontSize: 22, fontWeight: '800', color: '#103724' },
  photo: { width: '100%', height: 260, resizeMode: 'contain', backgroundColor: '#E7ECE7' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#A4B5A7', borderRadius: 8, padding: 10, backgroundColor: 'white', color: '#103724' },
  card: { padding: 14, gap: 10, borderWidth: 1, borderColor: '#A4B5A7', borderRadius: 12 },
  button: { backgroundColor: '#174D35', padding: 15, borderRadius: 10, alignItems: 'center' }, buttonText: { color: 'white', fontWeight: '700' },
  notice: { color: '#75510B', backgroundColor: '#FFF3D0', padding: 10 }, error: { color: '#A02222' },
  holes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, hole: { width: 52, gap: 4 }, choice: { padding: 12, backgroundColor: '#DDEAD9', marginRight: 8, borderRadius: 8 },
});
