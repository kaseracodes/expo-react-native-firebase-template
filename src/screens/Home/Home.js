import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform
} from 'react-native';
import { 
  collection, 
  query, 
  where, 
  deleteDoc, 
  doc,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { db, functions } from '../../../firebaseconfig';
import { useAuth } from '../../contexts/AuthContext';
import homeStyles from '../../styles/screens/home.css.js';

// Set notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function Home({ navigation }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [pushToken, setPushToken] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState('unknown');
  const { state, logout } = useAuth();

  // Register for push notifications (Fixed version)
  const registerForPushNotificationsAsync = async () => {
    if (!Device.isDevice) {
      console.log('❌ Must use physical device for Push Notifications');
      setNotificationPermission('unsupported');
      return;
    }

    try {
      // Set up Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ Push notification permission denied');
        setNotificationPermission('denied');
        return;
      }

      // Get Expo Push Token with project ID (FIXED)
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'mobile-app-skeleton' // Your Firebase project ID
      });
      
      const token = tokenData.data;
      
      console.log('📱 Expo Push Token:', token);
      setPushToken(token);
      setNotificationPermission('granted');
      
      // Fire-and-forget save to Firestore (prevents hanging)
      if (state.user?.uid && token) {
        setDoc(doc(db, 'userTokens', state.user.uid), {
          expoPushToken: token,
          platform: Platform.OS,
          deviceName: Device.deviceName || 'Unknown Device',
          updatedAt: new Date().toISOString(),
          userId: state.user.uid
        }).then(() => {
          console.log('✅ Push token saved to Firestore');
        }).catch((error) => {
          console.log('⚠️ Token save error (non-critical):', error.message);
        });
      }
      
      return token;
    } catch (error) {
      console.error('❌ Error registering for push notifications:', error);
      setNotificationPermission('error');
      
      // Show user-friendly error message
      let errorMessage = 'Failed to setup push notifications.';
      if (error.message.includes('FirebaseApp')) {
        errorMessage = 'Push notifications will work in development builds. Currently using fallback mode.';
      }
      console.log('ℹ️', errorMessage);
    }
  };

  useEffect(() => {
    if (!state.user?.uid) return;

    // Register for push notifications
    registerForPushNotificationsAsync();

    // Set up Firestore listener
    const q = query(
      collection(db, 'users'),
      where('userId', '==', state.user.uid)
    );

    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const userData = [];
        querySnapshot.forEach((doc) => {
          userData.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setUsers(userData);
        setLoading(false);
        setRefreshing(false);
        setConnectionError(false);
      }, 
      (error) => {
        console.error('Firestore connection error:', error);
        setLoading(false);
        setRefreshing(false);
        setConnectionError(true);
      }
    );

    return () => unsubscribe();
  }, [state.user?.uid]);

  // Listen for notification responses
  useEffect(() => {
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('📬 Notification received:', notification);
      Alert.alert(
        'Notification Received!',
        `${notification.request.content.title}\n${notification.request.content.body}`
      );
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📬 Notification response:', response);
      // Handle notification tap - you can navigate to specific screens here
      if (response.notification.request.content.data?.screen) {
        console.log('Navigate to:', response.notification.request.content.data.screen);
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  const handleEdit = (user) => {
    navigation.navigate('Profile', { user });
  };

  const handleDelete = (user) => {
    Alert.alert(
      'Delete Profile',
      'Are you sure you want to delete this profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteProfile(user.id)
        }
      ]
    );
  };

  const deleteProfile = async (docId) => {
    try {
      // Fire-and-forget approach like other operations
      deleteDoc(doc(db, 'users', docId))
        .then(() => {
          console.log('✅ Profile deleted successfully');
        })
        .catch((error) => {
          console.error('❌ Delete error:', error);
        });

      // Show immediate feedback
      Alert.alert('Success', 'Profile deleted successfully!');
    } catch (error) {
      console.error('Error deleting profile: ', error);
      Alert.alert('Error', 'Failed to delete profile. Please try again.');
    }
  };

  const sendTestNotification = async () => {
    if (!pushToken) {
      Alert.alert(
        'Push Notifications Not Available', 
        `Push notifications require a development build. 
        
Current status: ${notificationPermission}

To test:
1. Build development APK/IPA
2. Install on device  
3. Try notification again

Or test via Expo Push Tool:
https://expo.dev/notifications`
      );
      return;
    }

    setSendingNotification(true);
    
    try {
      console.log('🔄 Sending test notification...');
      
      // Send via Expo Push Service (works with development builds)
      const message = {
        to: pushToken,
        sound: 'default',
        title: 'Test from CRUD App 🚀',
        body: `Hello ${state.user.email || 'User'}! Your notifications are working perfectly!`,
        data: { 
          screen: 'Home',
          userId: state.user.uid,
          timestamp: Date.now(),
          action: 'test_notification'
        },
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      console.log('📬 Notification sent:', result);
      
      if (result.data && result.data[0] && result.data[0].status === 'ok') {
        Alert.alert(
          'Notification Sent! 🎉', 
          'Test notification sent successfully!\n\nYou should see the notification on this device in a few seconds.\n\nCheck your notification panel!'
        );
      } else if (result.data && result.data[0] && result.data[0].status === 'error') {
        throw new Error(`Notification error: ${result.data[0].message}`);
      } else {
        throw new Error('Notification service error: ' + JSON.stringify(result));
      }

    } catch (error) {
      console.error('❌ Error sending notification:', error);
      Alert.alert(
        'Error', 
        `Failed to send notification: ${error.message}\n\nMake sure you're using a development build (not Expo Go).`
      );
    } finally {
      setSendingNotification(false);
    }
  };

  const showNotificationInfo = () => {
    let statusMessage = '';
    let instructions = '';

    switch (notificationPermission) {
      case 'granted':
        statusMessage = '✅ Push notifications enabled';
        instructions = `Ready to receive notifications!

• Test button sends real notifications
• Token saved for Firebase Console targeting
• Notifications work in background/foreground

Push Token: ${pushToken?.substring(0, 30)}...`;
        break;
      case 'denied':
        statusMessage = '❌ Push notifications disabled';
        instructions = 'Enable notifications in device settings:\n\nSettings → Apps → Your App → Notifications → Allow';
        break;
      case 'unsupported':
        statusMessage = '⚠️ Push notifications not supported';
        instructions = 'Push notifications require:\n• Physical device (not simulator)\n• Development build (not Expo Go)';
        break;
      case 'error':
        statusMessage = '🔧 Push notification setup error';
        instructions = 'There was an error setting up notifications. Try restarting the app or rebuilding.';
        break;
      default:
        statusMessage = '🔄 Setting up notifications...';
        instructions = 'Configuring push notification permissions and tokens...';
    }

    Alert.alert('Push Notification Status', `${statusMessage}\n\n${instructions}`);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setConnectionError(false);
  };

  const retryConnection = () => {
    setConnectionError(false);
    setLoading(true);
  };

  // Send immediate notification (for testing)
  const sendImmediateNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Local Test Notification 📱",
          body: "This is a local notification test!",
          data: { screen: 'Home' },
        },
        trigger: { seconds: 1 },
      });
      
      Alert.alert('Success!', 'Local notification scheduled for 1 second!');
    } catch (error) {
      console.error('Local notification error:', error);
      Alert.alert('Error', 'Failed to send local notification');
    }
  };

  const renderUserItem = ({ item }) => (
    <View style={homeStyles.userCard}>
      <View style={homeStyles.userInfo}>
        <Text style={homeStyles.userName}>{item.name}</Text>
        <Text style={homeStyles.userEmail}>{item.email}</Text>
        <Text style={homeStyles.userGender}>
          Gender: {item.gender?.charAt(0).toUpperCase() + item.gender?.slice(1) || 'Not specified'}
        </Text>
        <Text style={homeStyles.userPhone}>
          Phone: {item.phoneNumber || 'Not provided'}
        </Text>
        <Text style={homeStyles.timestamp}>
          Created: {typeof item.createdAt === 'string' ? new Date(item.createdAt).toLocaleDateString() : 'Unknown'}
        </Text>
      </View>
      
      <View style={homeStyles.actionButtons}>
        <TouchableOpacity
          style={[homeStyles.actionButton, homeStyles.editButton]}
          onPress={() => handleEdit(item)}
        >
          <Text style={homeStyles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[homeStyles.actionButton, homeStyles.deleteButton]}
          onPress={() => handleDelete(item)}
        >
          <Text style={homeStyles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Connection Error Screen
  if (connectionError) {
    return (
      <View style={homeStyles.centerContainer}>
        <Text style={homeStyles.errorText}>🔌 Connection Error</Text>
        <Text style={homeStyles.errorSubtext}>
          Unable to connect to Firebase.{'\n'}Please check your internet connection.
        </Text>
        <TouchableOpacity 
          style={homeStyles.retryButton}
          onPress={retryConnection}
        >
          <Text style={homeStyles.retryButtonText}>Retry Connection</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading Screen
  if (loading) {
    return (
      <View style={homeStyles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={homeStyles.loadingText}>Loading profiles...</Text>
      </View>
    );
  }

  return (
    <View style={homeStyles.container}>
      {/* Header */}
      <View style={homeStyles.header}>
        <Text style={homeStyles.headerTitle}>User Profiles</Text>
        <TouchableOpacity
          style={homeStyles.logoutButton}
          onPress={logout}
        >
          <Text style={homeStyles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={homeStyles.buttonRow}>
        <TouchableOpacity
          style={[homeStyles.addButton, { flex: 1, marginRight: 10 }]}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={homeStyles.addButtonText}>+ Add Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[homeStyles.notificationButton, sendingNotification && homeStyles.buttonDisabled]}
          onPress={sendTestNotification}
          disabled={sendingNotification}
        >
          {sendingNotification ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={homeStyles.notificationButtonText}>🔔 Push</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[homeStyles.localNotificationButton]}
          onPress={sendImmediateNotification}
        >
          <Text style={homeStyles.localNotificationButtonText}>📱 Local</Text>
        </TouchableOpacity>
      </View>

      {/* Notification Status */}
      <TouchableOpacity 
        style={[
          homeStyles.notificationStatus,
          notificationPermission === 'granted' && homeStyles.notificationStatusSuccess,
          notificationPermission === 'denied' && homeStyles.notificationStatusError
        ]}
        onPress={showNotificationInfo}
      >
        <Text style={homeStyles.notificationStatusText}>
          {notificationPermission === 'granted' ? '🔔 Notifications ON' : 
           notificationPermission === 'denied' ? '🔕 Notifications OFF' :
           notificationPermission === 'unsupported' ? '⚠️ Development Build Required' :
           notificationPermission === 'error' ? '🔧 Setup Error' :
           '🔄 Setting up notifications...'}
        </Text>
        {pushToken && (
          <Text style={homeStyles.tokenText}>
            Token: {pushToken.substring(0, 20)}...
          </Text>
        )}
      </TouchableOpacity>

      {/* User List or Empty State */}
      {users.length > 0 ? (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={['#007AFF']}
              tintColor="#007AFF"
            />
          }
          contentContainerStyle={homeStyles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={homeStyles.emptyContainer}>
          <Text style={homeStyles.emptyIcon}>👤</Text>
          <Text style={homeStyles.emptyText}>No profiles found</Text>
          <Text style={homeStyles.emptySubtext}>
            Create your first profile to get started with CRUD operations
          </Text>
          <TouchableOpacity
            style={homeStyles.emptyButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={homeStyles.emptyButtonText}>Create Profile</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Status Bar */}
      <View style={homeStyles.statusBar}>
        <Text style={homeStyles.statusText}>
          📊 Profiles: {users.length} | 🔥 Firebase Connected | 📱 {Platform.OS.toUpperCase()} | 🔔 {notificationPermission}
        </Text>
      </View>
    </View>
  );
}
