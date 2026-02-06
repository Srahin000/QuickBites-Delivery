import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, SafeAreaView, FlatList, TouchableOpacity, TextInput, Alert, Switch, RefreshControl } from 'react-native';
import supabase from '../../supabaseClient';
import { themeColors } from '../../theme';
import * as Icon from 'react-native-feather';
import { useNavigation } from '@react-navigation/native';

export default function EditRestaurantScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [saving, setSaving] = useState({});
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter((r) => {
      const hay = `${r.restaurant_name || ''} ${r.address || ''} ${r.category || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [restaurants, query]);

  const fetchRestaurants = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurant_master')
        .select('restaurant_id, restaurant_name, address, category, active, menu_items(id, dish_name, menu_price, description, out_of_stock, load_unit)')
        .order('restaurant_name', { ascending: true });
      if (error) throw error;
      setRestaurants(data || []);
    } catch (err) {
      console.error('EditRestaurantScreen fetch error:', err);
      Alert.alert('Error', err?.message || 'Failed to load restaurants');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRestaurants(false);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRestaurants(true);
  };

  const updateRestaurant = async (restaurant_id, patch) => {
    setSaving((p) => ({ ...p, [`r:${restaurant_id}`]: true }));
    try {
      const { error } = await supabase.from('restaurant_master').update(patch).eq('restaurant_id', restaurant_id);
      if (error) throw error;
      setRestaurants((prev) => prev.map((r) => (r.restaurant_id === restaurant_id ? { ...r, ...patch } : r)));
    } catch (err) {
      console.error('updateRestaurant error:', err);
      Alert.alert('Error', err?.message || 'Failed to update restaurant');
    } finally {
      setSaving((p) => ({ ...p, [`r:${restaurant_id}`]: false }));
    }
  };

  const updateMenuItem = async (menuItemId, patch) => {
    setSaving((p) => ({ ...p, [`m:${menuItemId}`]: true }));
    try {
      const { error } = await supabase.from('menu_items').update(patch).eq('id', menuItemId);
      if (error) throw error;
      setRestaurants((prev) =>
        prev.map((r) => ({
          ...r,
          menu_items: (r.menu_items || []).map((mi) => (mi.id === menuItemId ? { ...mi, ...patch } : mi)),
        }))
      );
    } catch (err) {
      console.error('updateMenuItem error:', err);
      Alert.alert('Error', err?.message || 'Failed to update menu item');
    } finally {
      setSaving((p) => ({ ...p, [`m:${menuItemId}`]: false }));
    }
  };

  const renderMenuItem = (mi) => {
    const busy = !!saving[`m:${mi.id}`];
    return (
      <View key={mi.id} className="bg-gray-50 rounded-xl p-3 mb-2 border border-gray-200">
        <View className="flex-row items-center justify-between">
          <Text className="text-gray-900 font-semibold" style={{ flex: 1, paddingRight: 10 }}>{mi.dish_name}</Text>
          <View className="flex-row items-center">
            <Text className="text-xs text-gray-500 mr-2">Out</Text>
            <Switch value={!!mi.out_of_stock} disabled={busy} onValueChange={(v) => updateMenuItem(mi.id, { out_of_stock: v })} />
          </View>
        </View>

        <View className="flex-row items-center mt-2">
          <Text className="text-gray-700 mr-2">$</Text>
          <TextInput
            defaultValue={mi.menu_price != null ? String(mi.menu_price) : ''}
            keyboardType="numeric"
            style={{ flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: '#111827' }}
            onEndEditing={(e) => {
              const raw = (e.nativeEvent.text || '').trim();
              const num = raw === '' ? null : Number(raw);
              if (raw !== '' && Number.isNaN(num)) return;
              updateMenuItem(mi.id, { menu_price: num });
            }}
            placeholder="Price"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <TextInput
          defaultValue={mi.description || ''}
          multiline
          style={{ marginTop: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: '#111827' }}
          onEndEditing={(e) => updateMenuItem(mi.id, { description: e.nativeEvent.text })}
          placeholder="Description"
          placeholderTextColor="#9CA3AF"
        />
        {busy ? <Text className="text-xs text-gray-500 mt-2">Saving…</Text> : null}
      </View>
    );
  };

  const renderRestaurant = ({ item }) => {
    const isOpen = !!expanded[item.restaurant_id];
    const busy = !!saving[`r:${item.restaurant_id}`];

    return (
      <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100" style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}>
        <TouchableOpacity onPress={() => setExpanded((p) => ({ ...p, [item.restaurant_id]: !p[item.restaurant_id] }))}>
          <View className="flex-row items-center justify-between">
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text className="text-lg font-semibold text-gray-900">{item.restaurant_name}</Text>
              <Text className="text-gray-600 text-sm">{item.category || '—'} • {item.address || '—'}</Text>
            </View>
            <Icon.ChevronDown width={22} height={22} stroke="#6B7280" style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} />
          </View>
        </TouchableOpacity>

        <View className="mt-3 flex-row items-center justify-between">
          <View style={{ flex: 1 }}>
            <Text className="text-gray-800 font-semibold">Online</Text>
            <Text className="text-gray-500 text-xs">Hide/show restaurant in customer app</Text>
          </View>
          <Switch value={item.active !== false} disabled={busy} onValueChange={(v) => updateRestaurant(item.restaurant_id, { active: v })} />
        </View>

        {isOpen ? (
          <View className="mt-4">
            <Text className="text-gray-900 font-bold mb-2">Menu Items</Text>
            {(item.menu_items || []).length === 0 ? (
              <Text className="text-gray-500">No menu items.</Text>
            ) : (
              (item.menu_items || []).map(renderMenuItem)
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
          <Text className="text-white text-xl font-bold">Catalog</Text>
          <View style={{ width: 40 }} />
        </View>

        <View className="bg-white rounded-2xl px-4 py-3 flex-row items-center">
          <Icon.Search width={18} height={18} stroke="#6B7280" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search restaurants"
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, marginLeft: 10, color: '#111827' }}
          />
        </View>
      </View>

      <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 }}>
        {loading ? (
          <Text className="text-gray-600 text-center mt-8">Loading catalog…</Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(r) => String(r.restaurant_id)}
            renderItem={renderRestaurant}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={<Text className="text-gray-500 text-center mt-8">No restaurants.</Text>}
          />
        )}
      </View>
    </SafeAreaView>
  );
}