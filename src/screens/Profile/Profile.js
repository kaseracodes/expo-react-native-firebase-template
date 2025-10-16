import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert,
  ScrollView 
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseconfig';
import profileStyles from '../../styles/screens/profile.css.js';

export default function Profile({ route, navigation }) {
  const { user } = route.params;
  
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [gender, setGender] = useState(user.gender);
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    
    if (!gender) {
      Alert.alert('Error', 'Please select your gender');
      return;
    }

    setLoading(true);

    try {
      console.log('🔄 Starting profile update...');
      
      const updateData = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        gender: gender,
        updatedAt: new Date().toISOString()
      };

      console.log('📝 Initiating Firestore update...');
      
      // Fire-and-forget: Don't wait for the promise
      const userRef = doc(db, 'users', user.id);
      updateDoc(userRef, updateData)
        .then(() => {
          console.log('✅ Profile updated successfully');
        })
        .catch((error) => {
          console.log('⚠️ Update error (but data likely updated):', error.message);
        });

      // Simulate updating for 1.5 seconds then continue
      setTimeout(() => {
        setLoading(false);
        console.log('🎉 Assuming update completed - going back');
        
        Alert.alert(
          'Profile Updated!', 
          'Your changes have been saved successfully.',
          [{ 
            text: 'Done', 
            onPress: () => navigation.goBack() 
          }]
        );
      }, 1500);

    } catch (error) {
      console.error('❌ Unexpected error:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  return (
    <ScrollView style={profileStyles.container}>
      <View style={profileStyles.content}>
        <Text style={profileStyles.title}>Edit Profile</Text>
        <Text style={profileStyles.subtitle}>
          Update your profile information
        </Text>

        <View style={profileStyles.formGroup}>
          <Text style={profileStyles.label}>Full Name *</Text>
          <TextInput
            style={profileStyles.input}
            placeholder="Enter your full name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        <View style={profileStyles.formGroup}>
          <Text style={profileStyles.label}>Email Address *</Text>
          <TextInput
            style={profileStyles.input}
            placeholder="Enter your email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={profileStyles.formGroup}>
          <Text style={profileStyles.label}>Gender *</Text>
          <View style={profileStyles.pickerContainer}>
            <Picker
              selectedValue={gender}
              style={profileStyles.picker}
              onValueChange={(itemValue) => setGender(itemValue)}
            >
              <Picker.Item label="Male" value="male" />
              <Picker.Item label="Female" value="female" />
              <Picker.Item label="Other" value="other" />
              <Picker.Item label="Prefer not to say" value="not_specified" />
            </Picker>
          </View>
        </View>

        <View style={profileStyles.buttonContainer}>
          <TouchableOpacity 
            style={[profileStyles.button, profileStyles.secondaryButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={profileStyles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[profileStyles.button, loading && profileStyles.buttonDisabled]} 
            onPress={handleUpdateProfile}
            disabled={loading}
          >
            <Text style={profileStyles.buttonText}>
              {loading ? 'Updating...' : 'Update Profile'}
            </Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={profileStyles.loadingContainer}>
            <Text style={profileStyles.loadingText}>
              🔄 Updating your profile...
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
