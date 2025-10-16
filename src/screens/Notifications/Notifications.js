import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  TextInput,
  Alert 
} from 'react-native';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  orderBy 
} from 'firebase/firestore';
import { db } from '../../../firebaseconfig';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { saveNotificationToFirestore } from '../../services/notificationService';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const { state } = useAuth();
  const { sendLocalNotification, expoPushToken } = useNotifications();

  useEffect(() => {
    if (!state.user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', state.user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const notificationData = [];
      querySnapshot.forEach((doc) => {
        notificationData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setNotifications(notificationData);
    });

    return () => unsubscribe();
  }, [state.user]);

  const createNotification = async () => {
    if (!newTitle.trim() || !newBody.trim()) {
      Alert.alert('Error', 'Please enter both title and body');
      return;
    }

    try {
      // Save to Firestore
      await saveNotificationToFirestore(newTitle, newBody, state.user.uid);
      
      // Send local notification
      await sendLocalNotification(newTitle, newBody);
      
      setNewTitle('');
      setNewBody('');
      Alert.alert('Success', 'Notification created and sent!');
    } catch (error) {
      console.error('Error creating notification:', error);
      Alert.alert('Error', 'Failed to create notification');
    }
  };

  const renderNotificationItem = ({ item }) => (
    <View style={styles.notificationCard}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
      <Text style={styles.timestamp}>
        {item.createdAt?.toDate?.()?.toLocaleString() || 'Just now'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Push Notifications</Text>
      
      <View style={styles.createSection}>
        <TextInput
          style={styles.input}
          placeholder="Notification Title"
          value={newTitle}
          onChangeText={setNewTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="Notification Body"
          value={newBody}
          onChangeText={setNewBody}
          multiline
        />
        <TouchableOpacity style={styles.button} onPress={createNotification}>
          <Text style={styles.buttonText}>Create & Send Notification</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subHeader}>Notification History</Text>
      
      {notifications.length > 0 ? (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
        />
      ) : (
        <Text style={styles.emptyText}>No notifications yet</Text>
      )}
    </View>
  );
}

const styles = {
  container: { flex: 1, padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  createSection: { marginBottom: 30 },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    padding: 15, 
    marginBottom: 10, 
    borderRadius: 8 
  },
  button: { 
    backgroundColor: '#007AFF', 
    padding: 16, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  subHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  notificationCard: { 
    backgroundColor: '#f9f9f9', 
    padding: 15, 
    marginBottom: 10, 
    borderRadius: 8 
  },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  body: { fontSize: 14, color: '#666', marginBottom: 5 },
  timestamp: { fontSize: 12, color: '#999' },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 50 }
};
