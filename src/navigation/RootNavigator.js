import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';

// Import screens
import Login from '../screens/Auth/Login/Login';
import Register from '../screens/Auth/Register/Register';
import Home from '../screens/Home/Home';
import Profile from '../screens/Profile/Profile';

const Stack = createStackNavigator();

export default function RootNavigator() {
  const { state } = useAuth();

  if (state.loading) {
    return null; // Or a loading screen
  }

  return (
    
      <Stack.Navigator 
        initialRouteName={state.isAuthenticated ? "Home" : "Login"}
        screenOptions={{
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        {state.isAuthenticated ? (
          <>
            <Stack.Screen 
              name="Home" 
              component={Home} 
              options={{ title: 'Dashboard' }}
            />
            <Stack.Screen 
              name="Register" 
              component={Register} 
              options={{ title: 'Add Profile' }}
            />
            <Stack.Screen 
              name="Profile" 
              component={Profile} 
              options={{ title: 'Edit Profile' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen 
              name="Login" 
              component={Login}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    
  );
}
