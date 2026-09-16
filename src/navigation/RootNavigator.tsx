import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import MoveStockScreen from '../screens/MoveStockScreen';
import SearchScreen from '../screens/SearchScreen';
import EventsScreen from '../screens/EventsScreen';

const Tab = createBottomTabNavigator();

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <LoginScreen />;

  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Μεταφορά" component={MoveStockScreen} />
        <Tab.Screen name="Αναζήτηση" component={SearchScreen} />
        <Tab.Screen name="Events" component={EventsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
