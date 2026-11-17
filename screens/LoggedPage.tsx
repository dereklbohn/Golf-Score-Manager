
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';
import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import TeamDashboard from '../components/TeamDashboard';
import ScorecardReview from '../components/ScorecardReview';

type LoggedPageProps = {
  userId: string;
  email: string;
  onSignOut: () => void;
};

type Page = 'dashboard' | 'camera' | 'preview' | 'review';

export default function LoggedPage({
  userId,
  email,
  onSignOut,
}: LoggedPageProps) {
  const [page, setPage] = useState<Page>('dashboard');
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [takingPicture, setTakingPicture] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [photoBase64, setPhotoBase64] = useState('');
  const captureLock = useRef(false);
  const cameraRef = useRef<CameraView>(null);

  const openCamera = async () => {
    if (!permission) {
      Alert.alert('Please wait', 'Camera permission is loading.');
      return;
    }

    if (!permission.granted) {
      const result = await requestPermission();

      if (!result.granted) {
        Alert.alert(
          'Camera permission required',
          'Allow camera access to scan your scorecard.',
        );
        return;
      }
    }

    setCameraReady(false);
    setPage('camera');
  };

  const takePicture = async () => {
    if (!cameraRef.current || !cameraReady || captureLock.current) {
      return;
    }

    try {
      captureLock.current = true;
      setTakingPicture(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.75,
        base64: true,
      });

      if (photo?.uri && photo.base64) {
        setPhotoBase64(photo.base64);
        setPhotoUri(photo.uri);
        setPage('preview');
      } else {
        throw new Error('Photo data unavailable');
      }
    } catch {
      Alert.alert(
        'Camera error',
        'Could not take the picture. Please try again.',
      );
    } finally {
      captureLock.current = false;
      setTakingPicture(false);
    }
  };

  const retakePicture = () => {
    setPhotoUri(null);
    setPhotoBase64('');
    setCameraReady(false);
    setPage('camera');
  };

  const keepPhoto = () => setPage('review');

  if (page === 'review' && photoUri && photoBase64) {
    return <SafeAreaView style={styles.safeArea}>
      <ScorecardReview userId={userId} photoUri={photoUri} image={photoBase64}
        onRetake={retakePicture} onDone={() => {
          setPhotoUri(null); setPhotoBase64(''); setPage('dashboard');
        }} />
    </SafeAreaView>;
  }

  if (page === 'camera') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#103724" />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerSide}
            onPress={() => setPage('dashboard')}
          >
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Scan Scorecard</Text>
          <View style={styles.headerSide} />
        </View>

        {!permission?.granted ? (
          <View style={styles.centered}>
            <Text style={styles.title}>Camera access needed</Text>
            <Text style={styles.description}>
              Allow camera access to photograph your golf scorecard.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={openCamera}
            >
              <Text style={styles.primaryButtonText}>Allow Camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
              onMountError={() => { setCameraReady(false); Alert.alert('Camera unavailable', 'Return to the dashboard and try opening the camera again.'); }}
              onCameraReady={() => setCameraReady(true)}
            />

            <View style={styles.cameraOverlay}>
              <Text style={styles.instruction}>
                Position the entire scorecard inside the frame
              </Text>
              <View style={styles.scorecardFrame} />
              <Text style={styles.cameraHint}>
                Keep the card flat and scores clear.
              </Text>
            </View>

            <View style={styles.cameraControls}>
              <TouchableOpacity
                style={[
                  styles.captureButton,
                  (!cameraReady || takingPicture) && styles.disabledButton,
                ]}
                onPress={takePicture}
                disabled={!cameraReady || takingPicture}
              >
                {takingPicture ? (
                  <ActivityIndicator color="#174D35" />
                ) : (
                  <View style={styles.captureInner} />
                )}
              </TouchableOpacity>

              <Text style={styles.captureLabel}>
                {cameraReady ? 'Take Scorecard Photo' : 'Opening camera...'}
              </Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    );
  }

  if (page === 'preview' && photoUri) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#103724" />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerSide}
            onPress={retakePicture}
          >
            <Text style={styles.backText}>‹ Retake</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Review Photo</Text>
          <View style={styles.headerSide} />
        </View>

        <View style={styles.previewContainer}>
          <Text style={styles.title}>Check your scorecard</Text>
          <Text style={styles.description}>
            Make sure all player names, holes, and scores are visible. Scanning sends this photo to Google for handwriting recognition. You will review the results before saving.
          </Text>

          <Image source={{ uri: photoUri }} style={styles.previewImage} />

          <TouchableOpacity style={styles.primaryButton} onPress={keepPhoto}>
            <Text style={styles.primaryButtonText}>Scan Names and Scores</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={retakePicture}
          >
            <Text style={styles.secondaryButtonText}>Take Another Photo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#103724" />

      <View style={styles.header}>
        <View style={styles.brand}>
          <Text style={styles.brandTitle}>Golf Score</Text>
          <Text style={styles.brandSubtitle}>MANAGER</Text>
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={() =>
            Alert.alert('Sign out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: onSignOut },
            ])
          }
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <TeamDashboard userId={userId} email={email} onScan={openCamera} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7F4',
  },
  header: {
    backgroundColor: '#103724',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flex: 1,
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
  signOutButton: {
    backgroundColor: '#C8ED76',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  signOutText: {
    color: '#103724',
    fontWeight: '800',
  },
  headerSide: {
    width: 65,
  },
  backText: {
    color: '#C8ED76',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  dashboard: {
    flex: 1,
    padding: 20,
  },
  eyebrow: {
    color: '#176B45',
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '800',
  },
  welcome: {
    color: '#103724',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 7,
  },
  accountEmail: {
    color: '#718078',
    fontSize: 13,
    marginTop: 5,
    marginBottom: 17,
  },
  teamCard: {
    backgroundColor: '#174D35',
    borderRadius: 17,
    padding: 18,
    marginBottom: 20,
  },
  cardLabel: {
    color: '#C8ED76',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 7,
  },
  placeholderNote: {
    color: '#D1E6D5',
    fontSize: 11,
    marginTop: 5,
  },
  separator: {
    height: 1,
    backgroundColor: '#FFFFFF40',
    marginVertical: 14,
  },
  memberName: {
    color: '#FFFFFF',
    fontSize: 13,
    marginTop: 7,
  },
  sectionTitle: {
    color: '#103724',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E0E7E1',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreTeam: {
    color: '#103724',
    fontSize: 15,
    fontWeight: '800',
  },
  scoreCaption: {
    color: '#718078',
    fontSize: 11,
    marginTop: 5,
  },
  scoreValue: {
    color: '#176B45',
    fontSize: 24,
    fontWeight: '900',
  },
  sampleNote: {
    color: '#879189',
    fontSize: 10,
    marginTop: 8,
    marginBottom: 15,
  },
  primaryButton: {
    backgroundColor: '#174D35',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: '#E7F2EA',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#174D35',
    fontSize: 14,
    fontWeight: '800',
  },
  centered: {
    flex: 1,
    padding: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#103724',
    fontSize: 23,
    fontWeight: '900',
    marginBottom: 8,
  },
  description: {
    color: '#718078',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 20,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    ...StyleSheet.absoluteFill,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  instruction: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: '#00000080',
    padding: 10,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 25,
  },
  scorecardFrame: {
    width: '100%',
    height: '43%',
    borderWidth: 2,
    borderColor: '#C8ED76',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  cameraHint: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 20,
    backgroundColor: '#00000080',
    padding: 8,
    borderRadius: 7,
    overflow: 'hidden',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 25,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 5,
    borderColor: '#C8ED76',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#174D35',
  },
  disabledButton: {
    opacity: 0.5,
  },
  captureLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
  previewContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '53%',
    resizeMode: 'contain',
    backgroundColor: '#E7ECE7',
    borderRadius: 12,
    marginBottom: 24,
  },
});
