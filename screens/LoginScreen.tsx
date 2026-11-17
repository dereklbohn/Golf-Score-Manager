
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type LoginScreenProps = {
  onLogin: (email: string, password: string) => void;
  onSignupPress: () => void;
  onHomePress: () => void;
};

export default function LoginScreen({
  onLogin,
  onSignupPress,
  onHomePress,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing information', 'Please enter your email and password.');
      return;
    }

    onLogin(email.trim(), password);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          style={styles.logoCircle}
          onPress={onHomePress}
          accessibilityRole="button"
          accessibilityLabel="Go to home screen"
        >
          <Text style={styles.logo}>G</Text>
        </Pressable>

        <Text style={styles.title}>Welcome to Back</Text>
        <Text style={styles.subtitle}>
          Sign in to continue to Golf Score Manager
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#929AA5"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#929AA5"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
          />

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleLogin}
          >
            <Text style={styles.primaryButtonText}>Log In</Text>
          </Pressable>

          <View style={styles.signupRow}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <Pressable onPress={onSignupPress} hitSlop={8}>
              <Text style={styles.link}>Sign Up</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.bottomNote}>
          Your game. Your team. Every score.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7F4',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingVertical: 36,
  },
  logoCircle: {
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#176B45',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  logo: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '800',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#17251D',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#66736A',
    textAlign: 'center',
    marginTop: 9,
    marginBottom: 32,
    lineHeight: 21,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#26372D',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#D9E1DA',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 15,
    color: '#17251D',
  },
  primaryButton: {
    height: 54,
    backgroundColor: '#176B45',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#66736A',
    fontSize: 14,
  },
  link: {
    color: '#176B45',
    fontSize: 14,
    fontWeight: '800',
  },
  bottomNote: {
    textAlign: 'center',
    color: '#8A948D',
    fontSize: 12,
    marginTop: 36,
  },
});
