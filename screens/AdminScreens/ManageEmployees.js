import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, SafeAreaView, FlatList, TouchableOpacity, TextInput, Alert, Switch, RefreshControl } from 'react-native';
import supabase from '../../supabaseClient';
import { themeColors } from '../../theme';
import * as Icon from 'react-native-feather';
import { useNavigation } from '@react-navigation/native';

export default function ManageEmployees() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [deliverers, setDeliverers] = useState([]);
  const [updating, setUpdating] = useState({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return deliverers;
    return deliverers.filter((u) => {
      const hay = `${u.first_name || ''} ${u.last_name || ''} ${u.email || ''} ${u.phone || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [deliverers, query]);

  const fetchDeliverers = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role, phone, verified, is_online, created_at')
        .eq('role', 'deliverer')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeliverers(data || []);
    } catch (err) {
      console.error('ManageEmployees fetch error:', err);
      Alert.alert('Error', err?.message || 'Failed to load deliverers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeliverers(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDeliverers(true);
  };

  const updateDeliverer = async (id, patch) => {
    setUpdating((p) => ({ ...p, [id]: true }));
    try {
      const { error } = await supabase.from('users').update(patch).eq('id', id);
      if (error) throw error;
      setDeliverers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    } catch (err) {
      console.error('ManageEmployees update error:', err);
      Alert.alert('Error', err?.message || 'Failed to update deliverer');
    } finally {
      setUpdating((p) => ({ ...p, [id]: false }));
    }
  };

  const promptEditPhone = (deliverer) => {
    Alert.prompt?.(
      'Set Phone Number',
      `Enter phone for ${deliverer.first_name || ''} ${deliverer.last_name || ''}`.trim(),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: (value) => updateDeliverer(deliverer.id, { phone: (value || '').trim() }),
        },
      ],
      'plain-text',
      deliverer.phone || ''
    );
    // Android doesn't support Alert.prompt in RN (unless polyfilled). Fallback:
    if (!Alert.prompt) {
      Alert.alert(
        'Set Phone Number',
        'Android does not support inline prompt here. Edit phone from Deliverer Profile (recommended) or we can add a phone edit modal.',
        [{ text: 'OK' }]
      );
    }
  };

  const renderItem = ({ item }) => {
    const name = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Deliverer';
    const busy = !!updating[item.id];

    return (
      <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100" style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}>
        <View className="flex-row items-center justify-between">
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text className="text-lg font-semibold text-gray-900">{name}</Text>
            <Text className="text-gray-600">{item.email || '—'}</Text>
            <Text className="text-gray-700 mt-1">Phone: {item.phone || '—'}</Text>
          </View>

          <TouchableOpacity
            disabled={busy}
            onPress={() => promptEditPhone(item)}
            className="px-3 py-2 rounded-xl"
            style={{ backgroundColor: busy ? '#e5e7eb' : themeColors.purple }}
          >
            <Text className="text-white font-semibold">{busy ? '...' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        <View className="mt-4 flex-row items-center justify-between">
          <View style={{ flex: 1 }}>
            <Text className="text-gray-800 font-semibold">Verified</Text>
            <Text className="text-gray-500 text-xs">Allow this deliverer to take orders</Text>
          </View>
          <Switch
            value={!!item.verified}
            onValueChange={(v) => updateDeliverer(item.id, { verified: v })}
            disabled={busy}
          />
        </View>

        <View className="mt-3 flex-row items-center justify-between">
          <View style={{ flex: 1 }}>
            <Text className="text-gray-800 font-semibold">Online</Text>
            <Text className="text-gray-500 text-xs">Availability for order coverage</Text>
          </View>
          <Switch
            value={!!item.is_online}
            onValueChange={(v) => updateDeliverer(item.id, { is_online: v })}
            disabled={busy}
          />
        </View>
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
          <Text className="text-white text-xl font-bold">Manage Deliverers</Text>
          <View style={{ width: 40 }} />
        </View>

        <View className="bg-white rounded-2xl px-4 py-3 flex-row items-center">
          <Icon.Search width={18} height={18} stroke="#6B7280" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, email, phone"
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, marginLeft: 10, color: '#111827' }}
          />
        </View>
      </View>

      <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 }}>
        {loading ? (
          <Text className="text-gray-600 text-center mt-8">Loading deliverers…</Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(u) => u.id}
            renderItem={renderItem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={<Text className="text-gray-500 text-center mt-8">No deliverers found.</Text>}
          />
        )}
      </View>
    </SafeAreaView>
  );
}