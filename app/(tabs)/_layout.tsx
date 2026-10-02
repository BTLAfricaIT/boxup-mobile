import { Tabs } from 'expo-router'
import { TrendingUp, Store, Zap, Target, User } from 'lucide-react-native'
import { useAuth } from '../../contexts/AuthContext'

export default function TabLayout() {
  const { profile } = useAuth()
  // Agents are scoped to one project with one type; managers/staff/no-project-yet see everything.
  const type = profile?.role === 'agent' ? profile?.project?.type : undefined
  const showSales = !type || type === 'sales'
  const showVisits = !type || type === 'visit'
  const showEvents = !type || type === 'event'

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4d7c0f',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { borderTopColor: '#e2e8f0' },
        headerStyle: { backgroundColor: '#4d7c0f' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <TrendingUp size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="sales"
        options={{ title: 'Sales', tabBarIcon: ({ color }) => <TrendingUp size={22} color={color} />, href: showSales ? undefined : null }}
      />
      <Tabs.Screen
        name="visits"
        options={{ title: 'Visits', tabBarIcon: ({ color }) => <Store size={22} color={color} />, href: showVisits ? undefined : null }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: 'Events', tabBarIcon: ({ color }) => <Zap size={22} color={color} />, href: showEvents ? undefined : null }}
      />
      <Tabs.Screen
        name="targets"
        options={{ title: 'Targets', tabBarIcon: ({ color }) => <Target size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <User size={22} color={color} /> }}
      />
    </Tabs>
  )
}
