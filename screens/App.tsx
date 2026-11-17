
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './FirebaseConfig';

import LoginScreen from './LoginScreen';
import SignupScreen from './SignupScreen';
import LoggedPage from './LoggedPage';

type Screen = 'home' | 'login' | 'signup';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCheckingAuth(false);
    });

    return unsubscribe;
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
      setWorking(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      Alert.alert(
        'Login failed',
        error?.message ?? 'Please check your email and password.',
      );
    } finally {
      setWorking(false);
    }
  };

  const handleSignup = async (
    name: string,
    email: string,
    password: string,
  ) => {
    let accountCreated = false;
    try {
      setWorking(true);

      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      accountCreated = true;

      await updateProfile(credential.user, {
        displayName: name.trim(),
      });

      await setDoc(doc(db, 'users', credential.user.uid), {
        displayName: name.trim(),
        email: credential.user.email,
        createdAt: serverTimestamp(),
      });
    } catch (error: any) {
      Alert.alert(
        accountCreated ? 'Profile setup incomplete' : 'Signup failed',
        accountCreated
          ? `Your login account was created, but your profile could not be saved. You can still log in. ${error?.message ?? ''}`
          : error?.message ?? 'Could not create your account.',
      );
    } finally {
      setWorking(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setScreen('home');
    } catch (error: any) {
      Alert.alert(
        'Sign out failed',
        error?.message ?? 'Please try again.',
      );
    }
  };

  if (checkingAuth) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#176B45" />
          <Text style={styles.loadingText}>Checking your account...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  let content;

  if (user) {
    content = (
      <LoggedPage
        key={user.uid}
        userId={user.uid}
        email={user.email ?? ''}
        onSignOut={handleSignOut}
      />
    );
  } else if (screen === 'login') {
    content = (
      <LoginScreen
        onLogin={handleLogin}
        onSignupPress={() => setScreen('signup')}
        onHomePress={() => setScreen('home')}
      />
    );
  } else if (screen === 'signup') {
    content = (
      <SignupScreen
        onCreateAccount={handleSignup}
        onLoginPress={() => setScreen('login')}
      />
    );
  } else {
    content = (
      <SafeAreaView style={styles.home}>
        <StatusBar barStyle="light-content" backgroundColor="#103724" />

        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>Golf Score</Text>
            <Text style={styles.brandSubtitle}>MANAGER</Text>
          </View>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => setScreen('login')}
          >
            <Text style={styles.loginText}>Log In</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.homeContent}>
          <Text style={styles.eyebrow}>YOUR GOLF COMMUNITY</Text>
          <Text style={styles.homeTitle}>
            Every round.{'\n'}Every score.
          </Text>

          <Text style={styles.description}>
            Capture scorecards, record team results, and celebrate every winner.
          </Text>

          <View style={styles.featureCard}>
            <Text style={styles.featureEmoji}>🏆</Text>
            <Text style={styles.featureTitle}>Latest Champion</Text>
            <Text style={styles.featureTeam}>Eagle Masters</Text>
            <Text style={styles.featureScore}>286 strokes</Text>
            <Text style={styles.sampleNote}>Example result — sample data</Text>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setScreen('signup')}
          >
            <Text style={styles.primaryButtonText}>Create an Account</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            Sign in to view your team dashboard and scorecards.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaProvider>
      {working ? (
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="large" color="#176B45" />
          <Text style={styles.loadingText}>Please wait...</Text>
        </View>
      ) : (
        content
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: '#F5F7F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#176B45',
    fontSize: 14,
  },
  busyOverlay: {
    flex: 1,
    backgroundColor: '#F5F7F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  home: {
    flex: 1,
    backgroundColor: '#F5F7F4',
  },
  header: {
    backgroundColor: '#103724',
    paddingHorizontal: 22,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },
  brandSubtitle: {
    color: '#C8ED76',
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '700',
  },
  loginButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: '#C8ED76',
  },
  loginText: {
    color: '#103724',
    fontWeight: '800',
  },
  homeContent: {
    flex: 1,
    padding: 23,
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#174D35',
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '800',
    marginBottom: 10,
  },
  homeTitle: {
    color: '#103724',
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 44,
  },
  description: {
    color: '#718078',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    marginBottom: 22,
  },
  featureCard: {
    backgroundColor: '#174D35',
    borderRadius: 19,
    padding: 23,
    marginBottom: 24,
  },
  featureEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  featureTitle: {
    color: '#D1E6D5',
    fontSize: 12,
    fontWeight: '700',
  },
  featureTeam: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 7,
  },
  featureScore: {
    color: '#C8ED76',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
  },
  sampleNote: {
    color: '#D1E6D5',
    fontSize: 11,
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: '#174D35',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  footerText: {
    color: '#718078',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 19,
  },
});
