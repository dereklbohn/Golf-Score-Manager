import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal,
  Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addDoc, collection, doc, documentId, limit, onSnapshot, orderBy,
  query, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db } from '../screens/FirebaseConfig';
import { validGameDate, validStrokes } from '../utils/gameValidation';

type Member = { id: string; name: string };
type PlayerScore = { memberId: string; name: string; strokes: number };
type Game = { id: string; course: string; playedOn: string; players: PlayerScore[] };
type Props = { userId: string; email: string; onScan: () => void };

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function GameCard({ game }: { game: Game }) {
  const [year, month, day] = game.playedOn.split('-').map(Number);
  const label = new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  return (
    <View style={styles.gameCard}>
      <Text style={styles.cardTitle}>{game.course}</Text>
      <Text style={styles.muted}>{label}</Text>
      {game.players.map((player) => (
        <View key={player.memberId} style={styles.row}>
          <Text style={styles.playerName}>{player.name}</Text>
          <Text style={styles.score}>{player.strokes} strokes</Text>
        </View>
      ))}
    </View>
  );
}

function Button({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return (
    <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={[styles.button, secondary && styles.secondaryButton, disabled && styles.disabled]}>
      <Text style={secondary ? styles.secondaryText : styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

export default function TeamDashboard({ userId, email, onScan }: Props) {
  const [teamName, setTeamName] = useState('');
  const [teamDraft, setTeamDraft] = useState('');
  const [editingTeam, setEditingTeam] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberName, setMemberName] = useState('');
  const [recent, setRecent] = useState<Game[]>([]);
  const [loaded, setLoaded] = useState({ team: false, members: false, games: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const saveLock = useRef(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(20);
  const [history, setHistory] = useState<Game[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [course, setCourse] = useState('');
  const [playedOn, setPlayedOn] = useState(today);
  const [scores, setScores] = useState<Record<string, string>>({});

  useEffect(() => {
    const fail = (section: string) => (error: Error) => {
      setErrors((current) => ({ ...current, [section]: error.message }));
    };
    const stopTeam = onSnapshot(doc(db, 'teams', userId), (snapshot) => {
      setTeamName(snapshot.data()?.name ?? '');
      setLoaded((current) => ({ ...current, team: true }));
    }, fail('team'));
    const stopMembers = onSnapshot(query(collection(db, 'teams', userId, 'members'), orderBy('name')), (snapshot) => {
      setMembers(snapshot.docs.map((item) => ({ id: item.id, name: item.data().name })));
      setLoaded((current) => ({ ...current, members: true }));
    }, fail('members'));
    const stopGames = onSnapshot(query(collection(db, 'teams', userId, 'games'),
      orderBy('playedOn', 'desc'), orderBy(documentId(), 'desc'), limit(2)), (snapshot) => {
      setRecent(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Game));
      setLoaded((current) => ({ ...current, games: true }));
    }, fail('games'));
    return () => { stopTeam(); stopMembers(); stopGames(); };
  }, [userId, retry]);

  useEffect(() => {
    if (!historyOpen) return;
    return onSnapshot(query(collection(db, 'teams', userId, 'games'),
      orderBy('playedOn', 'desc'), orderBy(documentId(), 'desc'), limit(historyLimit)), (snapshot) => {
      setHistory(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Game));
      setHasMore(snapshot.size === historyLimit);
      setHistoryLoading(false);
    }, (error) => {
      setErrors((current) => ({ ...current, history: error.message }));
      setHistoryLoading(false);
    });
  }, [historyOpen, historyLimit, userId, retry]);

  const save = async (kind: string, action: () => Promise<void>) => {
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(kind);
    try {
      await action();
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      saveLock.current = false;
      setSaving(null);
    }
  };

  const saveTeam = () => {
    const name = teamDraft.trim();
    if (!name) return Alert.alert('Team name required', 'Enter your team name.');
    void save('team', async () => {
      await setDoc(doc(db, 'teams', userId), { name, updatedAt: serverTimestamp() }, { merge: true });
      setEditingTeam(false);
    });
  };

  const addMember = () => {
    const name = memberName.trim();
    if (!name) return Alert.alert('Name required', 'Enter the player’s name.');
    if (members.some((member) => member.name.toLowerCase() === name.toLowerCase())) {
      return Alert.alert('Member already added', 'Use a distinct name for each player.');
    }
    if (members.length >= 50) return Alert.alert('Team full', 'You can add up to 50 members.');
    void save('member', async () => {
      await addDoc(collection(db, 'teams', userId, 'members'), { name, createdAt: serverTimestamp() });
      setMemberName('');
    });
  };

  const saveGame = () => {
    if (!course.trim()) return Alert.alert('Course required', 'Enter a course or game name.');
    if (!validGameDate(playedOn) || playedOn > today()) {
      return Alert.alert('Invalid date', 'Enter a real date in YYYY-MM-DD format, today or earlier.');
    }
    const selected = members.filter((member) => (scores[member.id] ?? '').trim() !== '');
    if (!selected.length) return Alert.alert('Scores required', 'Enter a score for at least one player.');
    if (selected.some((member) => !validStrokes(scores[member.id]))) {
      return Alert.alert('Invalid score', 'Scores must be whole numbers between 1 and 999.');
    }
    void save('game', async () => {
      await addDoc(collection(db, 'teams', userId, 'games'), {
        course: course.trim(), playedOn,
        players: selected.map((member) => ({ memberId: member.id, name: member.name, strokes: Number(scores[member.id]) })),
        createdAt: serverTimestamp(),
      });
      setGameOpen(false);
      setCourse(''); setScores({}); setPlayedOn(today());
    });
  };

  const blocked = saving !== null;
  const errorNotice = (message: string) => (
    <View accessibilityRole="alert" style={styles.errorBox}>
      <Text style={styles.errorText}>Could not load your data. {message}</Text>
      <Button title="Retry" secondary onPress={() => {
        setErrors({});
        setLoaded({ team: false, members: false, games: false });
        setHistoryLoading(historyOpen);
        setRetry((value) => value + 1);
      }} />
    </View>
  );

  return (
    <>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>YOUR DASHBOARD</Text>
          <Text style={styles.heading}>Welcome to your team!</Text>
          <Text style={styles.muted}>{email}</Text>
          {Object.entries(errors).filter(([key]) => key !== 'history').map(([key, message]) => (
            <View key={key}>{errorNotice(message)}</View>
          ))}

          <View style={styles.teamCard}>
            <Text style={styles.lightLabel}>YOUR TEAM</Text>
            {!loaded.team && !errors.team ? <ActivityIndicator color="#C8ED76" /> : (
              <Text style={styles.teamTitle}>{teamName || 'Name your team'}</Text>
            )}
            {editingTeam ? (
              <>
                <TextInput accessibilityLabel="Team name" style={styles.input} value={teamDraft}
                  onChangeText={setTeamDraft} maxLength={80} placeholder="Team name" editable={!blocked} />
                <Button title={saving === 'team' ? 'Saving...' : 'Save Team Name'} onPress={saveTeam} disabled={blocked} secondary />
                <Button title="Cancel" secondary disabled={blocked} onPress={() => setEditingTeam(false)} />
              </>
            ) : <Button title={teamName ? 'Change Team Name' : 'Set Team Name'} secondary
              disabled={!loaded.team || blocked} onPress={() => { setTeamDraft(teamName); setEditingTeam(true); }} />}
          </View>

          <Text style={styles.sectionTitle}>Team Members</Text>
          {!loaded.members && !errors.members && <ActivityIndicator color="#176B45" />}
          {loaded.members && !members.length && <Text style={styles.muted}>Add your first player below.</Text>}
          {members.map((member) => <Text key={member.id} style={styles.member}>{member.name}</Text>)}
          <Text style={styles.label}>New player name</Text>
          <TextInput accessibilityLabel="New player name" style={styles.input} value={memberName}
            placeholder="Enter player name" maxLength={80} onChangeText={setMemberName} editable={!blocked}
            autoCapitalize="words" returnKeyType="done" onSubmitEditing={addMember} />
          <Button title={saving === 'member' ? 'Adding...' : 'Add Team Member'} onPress={addMember}
            disabled={blocked || !loaded.members} />

          <Text style={styles.sectionTitle}>Latest Games</Text>
          <Text style={styles.muted}>The two most recent games, newest first.</Text>
          {!loaded.games && !errors.games && <ActivityIndicator color="#176B45" />}
          {loaded.games && !recent.length && <Text style={styles.empty}>No games yet. Record your first round below.</Text>}
          {recent.map((game) => <GameCard key={game.id} game={game} />)}
          <Button title="More · Game History" secondary onPress={() => {
            setHistory([]); setHasMore(false); setHistoryLoading(true);
            setErrors((current) => { const next = { ...current }; delete next.history; return next; });
            setHistoryLimit(20); setHistoryOpen(true);
          }} />
          <Button title="Record Game" disabled={!loaded.members || !members.length || blocked}
            onPress={() => setGameOpen(true)} />
          {!members.length && <Text style={styles.muted}>Add a team member before recording a game.</Text>}
          <Button title="Scan a Scorecard" secondary onPress={onScan} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={historyOpen} animationType="slide" onRequestClose={() => setHistoryOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.heading}>Game History</Text>
            <Button title="Close" secondary onPress={() => setHistoryOpen(false)} />
          </View>
          <FlatList data={history} keyExtractor={(game) => game.id} renderItem={({ item }) => <GameCard game={item} />}
            contentContainerStyle={styles.content} ListHeaderComponent={<Text style={styles.muted}>All players · newest games first</Text>}
            ListEmptyComponent={!historyLoading && !errors.history ? <Text style={styles.empty}>No games recorded yet.</Text> : null}
            onEndReachedThreshold={0.3} onEndReached={() => {
              if (hasMore && !historyLoading && !errors.history) {
                setHistoryLoading(true); setHistoryLimit((value) => value + 20);
              }
            }}
            ListFooterComponent={errors.history ? errorNotice(errors.history) : historyLoading
              ? <ActivityIndicator color="#176B45" /> : hasMore
                ? <Button title="Load More Games" secondary onPress={() => { setHistoryLoading(true); setHistoryLimit((value) => value + 20); }} />
                : history.length ? <Text style={styles.empty}>You have reached the end of your games.</Text> : null} />
        </SafeAreaView>
      </Modal>

      <Modal visible={gameOpen} animationType="slide" onRequestClose={() => { if (!blocked) setGameOpen(false); }}>
        <SafeAreaView style={styles.modal}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text style={styles.heading}>Record Game</Text>
              <Text style={styles.label}>Course or game name</Text>
              <TextInput accessibilityLabel="Course or game name" style={styles.input} value={course}
                onChangeText={setCourse} maxLength={100} placeholder="e.g. Sunday round at Oak Hills" editable={!blocked} />
              <Text style={styles.label}>Date played (YYYY-MM-DD)</Text>
              <TextInput accessibilityLabel="Date played, YYYY-MM-DD" style={styles.input} value={playedOn}
                onChangeText={setPlayedOn} maxLength={10} autoCapitalize="none" placeholder="YYYY-MM-DD" editable={!blocked} />
              <Text style={styles.sectionTitle}>Player Scores</Text>
              <Text style={styles.muted}>Enter total strokes. Leave a player blank if they did not play.</Text>
              {members.map((member) => (
                <View key={member.id}>
                  <Text style={styles.label}>{member.name}</Text>
                  <TextInput accessibilityLabel={`Total strokes for ${member.name}`} style={styles.input}
                    value={scores[member.id] ?? ''} keyboardType="number-pad" maxLength={3}
                    placeholder="Total strokes" editable={!blocked}
                    onChangeText={(value) => setScores((current) => ({ ...current, [member.id]: value }))} />
                </View>
              ))}
              <Button title={saving === 'game' ? 'Saving...' : 'Save Game'} disabled={blocked} onPress={saveGame} />
              <Button title="Cancel" secondary disabled={blocked} onPress={() => setGameOpen(false)} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modal: { flex: 1, backgroundColor: '#F5F7F4' },
  modalHeader: { paddingHorizontal: 20, paddingTop: 12 },
  content: { padding: 20, paddingBottom: 40, gap: 10 },
  eyebrow: { color: '#176B45', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  heading: { color: '#103724', fontSize: 26, fontWeight: '900' },
  sectionTitle: { color: '#103724', fontSize: 20, fontWeight: '800', marginTop: 18 },
  muted: { color: '#58685F', fontSize: 14, lineHeight: 21 },
  empty: { color: '#58685F', paddingVertical: 18, lineHeight: 22 },
  teamCard: { backgroundColor: '#174D35', borderRadius: 18, padding: 20, gap: 12, marginTop: 12 },
  lightLabel: { color: '#C8ED76', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  teamTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  label: { color: '#103724', fontWeight: '700', fontSize: 14, marginTop: 8, marginBottom: 4 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#C5D2C8', borderRadius: 10,
    backgroundColor: '#FFFFFF', color: '#103724', fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  member: { backgroundColor: '#FFFFFF', color: '#103724', borderRadius: 10, padding: 14, fontSize: 16 },
  button: { backgroundColor: '#174D35', borderRadius: 10, minHeight: 48,
    paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  secondaryButton: { backgroundColor: '#E7F2EA' },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  secondaryText: { color: '#174D35', fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.5 },
  gameCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 14,
    borderWidth: 1, borderColor: '#E0E7E1', marginVertical: 6, gap: 6 },
  cardTitle: { color: '#103724', fontSize: 18, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 6 },
  playerName: { flex: 1, color: '#103724', fontSize: 15 },
  score: { color: '#176B45', fontWeight: '800', fontSize: 15 },
  errorBox: { padding: 12, backgroundColor: '#FFF0EB', borderRadius: 10, marginVertical: 4 },
  errorText: { color: '#8B2C17', lineHeight: 21 },
});
