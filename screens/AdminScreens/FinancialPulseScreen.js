import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Alert, TextInput, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Icon from 'react-native-feather';
import supabase from '../../supabaseClient';
import { themeColors } from '../../theme';

const EST_TOTAL_MULTIPLIER = 1.28875; // subtotal + 20% delivery + 8.875% tax
const EST_DELIVERY_FEE_RATE = 0.2; // of subtotal

function startOfDayISO(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

function endOfDayISO(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}

export default function FinancialPulseScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState([]);
  const [csv, setCsv] = useState('');

  const fetchToday = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, restaurant_id, restaurant_name, total, created_at, deliverer_id, user_id')
        .gte('created_at', startOfDayISO())
        .lte('created_at', endOfDayISO());
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('FinancialPulse fetch error:', err);
      Alert.alert('Error', err?.message || 'Failed to load today totals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchToday(false);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchToday(true);
  };

  const totals = useMemo(() => {
    const totalSales = (orders || []).reduce((sum, o) => sum + Number(o.total || 0), 0);
    // No explicit delivery fee stored; estimate from total
    const estSubtotal = totalSales / EST_TOTAL_MULTIPLIER;
    const estDeliveryFees = estSubtotal * EST_DELIVERY_FEE_RATE;
    return { totalSales, estDeliveryFees, estSubtotal };
  }, [orders]);

  const buildRestaurantCsv = () => {
    const map = {};
    (orders || []).forEach((o) => {
      const key = String(o.restaurant_id ?? o.restaurant_name ?? 'unknown');
      if (!map[key]) {
        map[key] = { restaurant_id: o.restaurant_id ?? '', restaurant_name: o.restaurant_name ?? '', gross_total: 0 };
      }
      map[key].gross_total += Number(o.total || 0);
    });
    const rows = Object.values(map).sort((a, b) => b.gross_total - a.gross_total);
    const header = 'restaurant_id,restaurant_name,gross_total';
    const lines = rows.map((r) => `${r.restaurant_id},${JSON.stringify(r.restaurant_name)},${r.gross_total.toFixed(2)}`);
    setCsv([header, ...lines].join('\n'));
  };

  const buildDelivererCsv = async () => {
    // Use delivered orders from order_history when available; fallback to orders table deliverer_id today.
    try {
      const { data: delivered, error } = await supabase
        .from('order_history')
        .select('deliverer_id, total, delivered_at')
        .gte('delivered_at', startOfDayISO())
        .lte('delivered_at', endOfDayISO());

      const source = error ? (orders || []).filter(o => o.deliverer_id) : (delivered || []);
      const map = {};
      source.forEach((o) => {
        const delivererId = o.deliverer_id;
        if (!delivererId) return;
        if (!map[delivererId]) map[delivererId] = { deliverer_id: delivererId, gross_total: 0 };
        map[delivererId].gross_total += Number(o.total || 0);
      });
      const rows = Object.values(map).sort((a, b) => b.gross_total - a.gross_total);
      const header = 'deliverer_id,gross_total';
      const lines = rows.map((r) => `${r.deliverer_id},${r.gross_total.toFixed(2)}`);
      setCsv([header, ...lines].join('\n'));
    } catch (err) {
      console.error('buildDelivererCsv error:', err);
      Alert.alert('Error', err?.message || 'Failed to build deliverer CSV');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.bgColor2 }}>
      <View style={{ padding: 16, paddingTop: 12 }}>
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 bg-white rounded-full">
            <Icon.ArrowLeft strokeWidth={3} stroke={themeColors.purple} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Financial Pulse</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <Text className="text-gray-600 text-center mt-8">Loading…</Text>
        ) : (
          <>
            <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
              <Text className="text-gray-900 text-lg font-bold mb-2">Today</Text>
              <Text className="text-gray-700">Total Sales (gross): ${totals.totalSales.toFixed(2)}</Text>
              <Text className="text-gray-700">Est. Delivery Fees: ${totals.estDeliveryFees.toFixed(2)}</Text>
              <Text className="text-xs text-gray-500 mt-2">
                Delivery fees are estimated because they are not stored explicitly in DB.
              </Text>
            </View>

            <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
              <Text className="text-gray-900 text-lg font-bold mb-3">Exports (CSV)</Text>

              <TouchableOpacity
                onPress={buildRestaurantCsv}
                className="bg-purple-600 rounded-xl p-3 mb-2 flex-row items-center justify-center"
              >
                <Icon.FileText width={18} height={18} stroke="#fff" />
                <Text className="text-white font-semibold ml-2">Generate Restaurant CSV</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={buildDelivererCsv}
                className="bg-purple-600 rounded-xl p-3 flex-row items-center justify-center"
              >
                <Icon.FileText width={18} height={18} stroke="#fff" />
                <Text className="text-white font-semibold ml-2">Generate Deliverer CSV</Text>
              </TouchableOpacity>

              <Text className="text-xs text-gray-500 mt-3">
                Copy/paste the CSV below into a file or spreadsheet.
              </Text>
            </View>

            <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-6">
              <Text className="text-gray-900 font-bold mb-2">CSV Output</Text>
              <TextInput
                value={csv}
                onChangeText={setCsv}
                multiline
                style={{ minHeight: 220, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, color: '#111827' }}
                placeholder="Tap Generate above…"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}





