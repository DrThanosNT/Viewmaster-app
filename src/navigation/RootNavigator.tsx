import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import LoginScreen from '../screens/LoginScreen';
import MoveStockScreen from '../screens/MoveStockScreen';
import OverviewScreen from '../screens/OverviewScreen';
import LogsScreen from '../screens/LogsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AdminScreen from '../screens/AdminScreen';

const Tab = createBottomTabNavigator();

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// [icon when active, icon when inactive] for each tab. To swap one, find a
// name at https://icons.expo.fyi (pick the Ionicons set) and change it here.
const TAB_ICONS: Record<string, [IconName, IconName]> = {
  'Απόθεμα': ['cube', 'cube-outline'],
  'Επισκόπηση': ['grid', 'grid-outline'],
  'Καταγραφές': ['time', 'time-outline'],
  'Διαχείριση': ['shield-checkmark', 'shield-checkmark-outline'],
  'Ρυθμίσεις': ['settings', 'settings-outline'],
};

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const { colors, mode } = useTheme();

  if (loading) return null;

  const navTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.paper,
      card: colors.card,
      border: colors.line,
      text: colors.ink,
      primary: colors.petrol,
    },
  };

  if (!user) {
    return (
      <>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <LoginScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: colors.ink,
            tabBarInactiveTintColor: colors.muted,
            tabBarStyle: { borderTopColor: colors.line, backgroundColor: colors.card },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            tabBarIcon: ({ focused, color, size }) => {
              const [active, inactive] = TAB_ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
              return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Απόθεμα" component={MoveStockScreen} />
          <Tab.Screen name="Επισκόπηση" component={OverviewScreen} />
          <Tab.Screen name="Καταγραφές" component={LogsScreen} />
          {user.role === 'ADMIN' && <Tab.Screen name="Διαχείριση" component={AdminScreen} />}
          <Tab.Screen name="Ρυθμίσεις" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}