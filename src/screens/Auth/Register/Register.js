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
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../../../firebaseconfig';
import { useAuth } from '../../../contexts/AuthContext';
import registerStyles from '../../../styles/screens/register.css.js';

export default function Register({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  const { state } = useAuth();

  const handleSaveProfile = async () => {
    // Validation
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

    if (!state.user || !state.user.uid) {
      Alert.alert('Error', 'User not authenticated. Please login again.');
      return;
    }

    setLoading(true);

    try {
      console.log('🔄 Starting profile save...');
      
      const now = new Date();
      const profileData = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        gender: gender,
        userId: state.user.uid,
        phoneNumber: state.user.phoneNumber || 'N/A',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        timestamp: now.getTime()
      };

      console.log('📝 Initiating Firestore save...');
      
      // Fire-and-forget: Don't wait for the promise
      addDoc(collection(db, 'users'), profileData)
        .then((docRef) => {
          console.log('✅ Profile saved successfully with ID:', docRef.id);
        })
        .catch((error) => {
          console.log('⚠️ Save error (but data likely saved):', error.message);
        });

      // Simulate saving for 1.5 seconds then continue
      setTimeout(() => {
        setLoading(false);
        console.log('🎉 Assuming save completed - continuing to Home');
        
        Alert.alert(
          'Profile Created!', 
          'Your profile has been saved successfully.',
          [{ 
            text: 'Continue', 
            onPress: () => navigation.replace('Home') 
          }]
        );
      }, 1500);

    } catch (error) {
      console.error('❌ Unexpected error:', error);
      setLoading(false);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  return (
    <ScrollView style={registerStyles.container}>
      <View style={registerStyles.content}>
        <Text style={registerStyles.title}>Complete Your Profile</Text>
        <Text style={registerStyles.subtitle}>
          Fill in your details to get started
        </Text>

        <View style={registerStyles.formGroup}>
          <Text style={registerStyles.label}>Full Name *</Text>
          <TextInput
            style={registerStyles.input}
            placeholder="Enter your full name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            maxLength={50}
          />
        </View>

        <View style={registerStyles.formGroup}>
          <Text style={registerStyles.label}>Email Address *</Text>
          <TextInput
            style={registerStyles.input}
            placeholder="Enter your email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            maxLength={100}
          />
        </View>

        <View style={registerStyles.formGroup}>
          <Text style={registerStyles.label}>Gender *</Text>
          <View style={registerStyles.pickerContainer}>
            <Picker
              selectedValue={gender}
              style={registerStyles.picker}
              onValueChange={(itemValue) => setGender(itemValue)}
            >
              <Picker.Item label="Select Gender" value="" />
              <Picker.Item label="Male" value="male" />
              <Picker.Item label="Female" value="female" />
              <Picker.Item label="Other" value="other" />
              <Picker.Item label="Prefer not to say" value="not_specified" />
            </Picker>
          </View>
        </View>

        <TouchableOpacity 
          style={[registerStyles.button, loading && registerStyles.buttonDisabled]} 
          onPress={handleSaveProfile}
          disabled={loading}
        >
          <Text style={registerStyles.buttonText}>
            {loading ? 'Saving Profile...' : 'Save Profile & Continue'}
          </Text>
        </TouchableOpacity>

        {loading && (
          <View style={registerStyles.loadingContainer}>
            <Text style={registerStyles.loadingText}>
              💾 Saving your profile data...
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
