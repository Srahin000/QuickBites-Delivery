import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, SafeAreaView, FlatList, TouchableOpacity, TextInput, Alert, RefreshControl } from 'react-native';
import supabase from '../../supabaseClient';
import { themeColors } from '../../theme';
import * as Icon from 'react-native-feather';
import { useNavigation } from '@react-navigation/native';

export default function ManageCustomers() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [ordersByUser, setOrdersByUser] = useState({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((u) => {
      const hay = `${u.first_name || ''} ${u.last_name || ''} ${u.email || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [customers, query]);

  const fetchCustomers = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role, created_at')
        .or('role.is.null,role.eq.customer')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('ManageCustomers fetch error:', err);
      Alert.alert('Error', err?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCustomers(false);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCustomers(true);
  };

  const loadOrdersForUser = async (userId) => {
    try {
      // Current orders
      const { data: currentOrders, error: curErr } = await supabase
        .from('orders')
        .select('id, order_code, restaurant_name, total, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (curErr) throw curErr;

      // Delivered history (if order_history exists)
      const { data: histOrders, error: histErr } = await supabase
        .from('order_history')
        .select('id, order_code, restaurant_name, total, created_at, delivered_at')
        .eq('user_id', userId)
        .order('delivered_at', { ascending: false })
        .limit(10);

      // If order_history not present / permissions, ignore gracefully
      const historySafe = histErr ? [] : (histOrders || []);

      setOrdersByUser((p) => ({
        ...p,
        [userId]: {
          current: currentOrders || [],
          history: historySafe,
        },
      }));
    } catch (err) {
      console.error('ManageCustomers loadOrders error:', err);
      Alert.alert('Error', err?.message || 'Failed to load order history');
    }
  };

  const toggleExpand = async (u) => {
    const next = !expanded[u.id];
    setExpanded((p) => ({ ...p, [u.id]: next }));
    if (next && !ordersByUser[u.id]) {
      await loadOrdersForUser(u.id);
    }
  };

  const renderOrderRow = (o, label) => (
    <View key={`${label}:${o.id}`} className="bg-gray-50 rounded-xl p-3 mb-2 border border-gray-200">
      <Text className="text-sm text-gray-500">#{o.order_code} • {o.restaurant_name}</Text>
      <Text className="text-gray-900 font-semibold">${Number(o.total || 0).toFixed(2)}</Text>
      <Text className="text-xs text-gray-500">{label === 'history' ? `Delivered: ${o.delivered_at || '—'}` : `Created: ${o.created_at || '—'}`}</Text>
    </View>
  );

  const renderItem = ({ item }) => {
    const name = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Customer';
    const isOpen = !!expanded[item.id];
    const data = ordersByUser[item.id];

    return (
      <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100" style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}>
        <TouchableOpacity onPress={() => toggleExpand(item)}>
          <View className="flex-row items-center justify-between">
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text className="text-lg font-semibold text-gray-900">{name}</Text>
              <Text className="text-gray-600">{item.email || '—'}</Text>
              <Text className="text-xs text-gray-500 mt-1">Created: {item.created_at || '—'}</Text>
            </View>
            <Icon.ChevronDown width={22} height={22} stroke="#6B7280" style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} />
          </View>
        </TouchableOpacity>

        {isOpen ? (
          <View className="mt-4">
            <Text className="text-gray-900 font-bold mb-2">Recent Orders</Text>
            {!data ? (
              <Text className="text-gray-500">Loading…</Text>
            ) : (
              <>
                {(data.current || []).length === 0 ? (
                  <Text className="text-gray-500 mb-2">No current orders.</Text>
                ) : (
                  (data.current || []).map((o) => renderOrderRow(o, 'current'))
                )}
                <Text className="text-gray-900 font-bold mt-3 mb-2">Delivered History</Text>
                {(data.history || []).length === 0 ? (
                  <Text className="text-gray-500">No delivered history.</Text>
                ) : (
                  (data.history || []).map((o) => renderOrderRow(o, 'history'))
                )}
              </>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.bgColor2 }}>
      <View style={{ padding: 16, paddingTop: 12 }}>
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 bg-white rounded-full">
            <Icon.ArrowLeft strokeWidth={3} stroke={themeColors.purple} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Customers</Text>
          <View style={{ width: 40 }} />
        </View>

        <View className="bg-white rounded-2xl px-4 py-3 flex-row items-center">
          <Icon.Search width={18} height={18} stroke="#6B7280" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or email"
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, marginLeft: 10, color: '#111827' }}
          />
        </View>
      </View>

      <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 }}>
        {loading ? (
          <Text className="text-gray-600 text-center mt-8">Loading customers…</Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(u) => u.id}
            renderItem={renderItem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={<Text className="text-gray-500 text-center mt-8">No customers found.</Text>}
          />
        )}
      </View>
    </SafeAreaView>
  );
}