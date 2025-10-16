// src/utils/networkUtils.js
import { Alert } from 'react-native';

export const handleFirestoreError = (error) => {
    console.log('Firestore Error:', error);
    
    if (error.code === 'unavailable') {
        Alert.alert(
            'Connection Issue',
            'Please check your internet connection and try again.'
        );
    } else if (error.code === 'permission-denied') {
        Alert.alert(
            'Permission Denied',
            'You do not have permission to access this data.'
        );
    } else {
        Alert.alert(
            'Error',
            'Something went wrong. Please try again.'
        );
    }
};

export const retryOperation = async (operation, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
};
