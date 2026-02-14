import { View, Text, ScrollView, TouchableOpacity, Image, Alert, RefreshControl, TextInput, ActivityIndicator } from 'react-native';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Icon from 'react-native-feather';
import { useStripe } from '@stripe/stripe-react-native';
import supabase from "../supabaseClient"
import { themeColors } from '../theme';
import { useCart } from '../context/CartContext';
import { useSession } from '../context/SessionContext-v2';
import TimeSlotModal from '../components/TimeSlotModal';
import LocationModal from '../components/LocationModal';
import notificationService from '../services/notificationService';
import { calculateCartLoad, getLoadWarning } from '../utils/cartLoadCalculator';
// Apple Pay is presented within Stripe PaymentSheet

const formatCustomizationLine = (customizations) => {
  if (!customizations) return '';

  if (typeof customizations === 'string') {
    return customizations;
  }

  if (Array.isArray(customizations)) {
    return customizations.filter(Boolean).join(', ');
  }

  if (typeof customizations === 'object') {
    return Object.entries(customizations)
      .filter(([, value]) => value && value !== false)
      .map(([key, value]) => {
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return value.toString();
        if (value === true) {
          return key.replace(/_/g, ' ');
        }
        return null;
      })
      .filter(Boolean)
      .join(', ');
  }

  return '';
};

const cardShadowStyle = {
  backgroundColor: 'white',
  borderRadius: 16,
  padding: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.04,
  shadowRadius: 12,
  elevation: 3,
  marginBottom: 18,
};

export default function CartScreen() {
  const [serviceOpen, setServiceOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState('10:00 AM');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [showTimeSlotModal, setShowTimeSlotModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showDevPay, setShowDevPay] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeOverride, setTimeOverride] = useState(false);
  const [instantPayEnabled, setInstantPayEnabled] = useState(false);
  const [appliedCoupons, setAppliedCoupons] = useState([]);
  const [selectedCouponUsageId, setSelectedCouponUsageId] = useState(null);
  const [pendingSelectedCouponId, setPendingSelectedCouponId] = useState(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [redeemingCoupon, setRedeemingCoupon] = useState(false);
  const [referralPromoEnabled, setReferralPromoEnabled] = useState(false);
  const [clubSupportEnabled, setClubSupportEnabled] = useState(false);
  const [supportingClub, setSupportingClub] = useState(null);
  const [clubInput, setClubInput] = useState('');
  const [clubExpanded, setClubExpanded] = useState(false);
  const [validatingClub, setValidatingClub] = useState(false);
  const [referralReward, setReferralReward] = useState(null);
  const [deliveryEstimate, setDeliveryEstimate] = useState(null);
  const [isShopFull, setIsShopFull] = useState(false);
  const [loadingSlot, setLoadingSlot] = useState(false);
  const [orderBlockError, setOrderBlockError] = useState(null);
  const [userHasManuallySelectedTime, setUserHasManuallySelectedTime] = useState(false);

  const today = new Date();
  const selectedDate = today;
  const currentHour = today.getHours();

  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const navigation = useNavigation();
  const route = useRoute();
  const { cartItems, clearCart, restaurant, addToCart, removeFromCart } = useCart();
  const { session } = useSession();
  const prevCartCountRef = useRef(cartItems.length);
  const pageBg = '#F8F9FB';
  const baseCardStyle = cardShadowStyle;
  const quantityButtonStyle = {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  };
  const renderSummaryRow = (label, value, { isTotal = false, valueColor } = {}) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: isTotal ? 0 : 10 }}>
      <Text
        style={{
          fontSize: isTotal ? 18 : 13,
          fontWeight: isTotal ? '800' : '500',
          color: isTotal ? '#111827' : '#6B7280',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: isTotal ? 22 : 14,
          fontWeight: isTotal ? '800' : '600',
          color: valueColor || '#111827',
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );

  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent?.();
      parent?.setOptions({
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderTopWidth: 0,
          position: 'absolute',
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarActiveTintColor: themeColors.purple,
      });
    }, [navigation])
  );

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = 0.20 * subtotal;
  const tax = 0.08875 * subtotal;
  
  // Calculate cart load score for capacity management
  const cartLoad = useMemo(() => calculateCartLoad(cartItems), [cartItems]);
  
  // Get load warning based on selected slot's capacity (or default 20.0 if no slot selected)
  const slotCapacity = selectedTimeSlot?.max_capacity_lu || 20.0;
  const loadWarning = useMemo(() => getLoadWarning(cartLoad.totalScore, slotCapacity), [cartLoad.totalScore, slotCapacity]);
  const transactionFeeRate = 0.029; // 2.9%
  const transactionFeeFixed = 0.30; // $0.30
  
  // Check if cart has items from multiple restaurants
  const uniqueRestaurants = [...new Set(cartItems.map(item => item.restaurant_name))];
  const hasMixedRestaurants = uniqueRestaurants.length > 1;
  const displayRestaurant = hasMixedRestaurants ? 'Mixed Order' : (cartItems.length > 0 && cartItems[0]?.restaurant_name ? cartItems[0].restaurant_name : restaurant?.restaurant_name || restaurant?.name || 'Restaurant');

  // We do NOT allow stacking coupons in the cart UI.
  // Only ONE coupon is active at a time, and only after the user explicitly selects it (e.g., immediately after redeeming a code).
  // No automatic best-coupon fallback so discounts never appear without user confirmation.
  const activeCoupons = useMemo(() => {
    const list = (appliedCoupons || []).filter((cu) => cu?.coupons);
    if (!selectedCouponUsageId) return [];
    const picked = list.find((cu) => cu.id === selectedCouponUsageId);
    return picked ? [picked] : [];
  }, [appliedCoupons, selectedCouponUsageId]);
  
  // Calculate coupon discounts using useMemo to prevent infinite re-renders
  const discounts = useMemo(() => {
    let totalDiscount = 0;
    let deliveryDiscount = 0;
    let subtotalDiscount = 0;
    
    // NOTE: Don't auto-apply referralReward discounts in cart UI.
    // Delivery/subtotal discounts should come from applied coupons only.
    
    activeCoupons.forEach(couponUsage => {
      const coupon = couponUsage.coupons;
      if (!coupon) return;
      
        switch (coupon.category) {
        case 'delivery-fee':
          // Completely removes delivery fee
          deliveryDiscount += deliveryFee;
          break;
        case 'referral':
          // REFERRAL50 - Applies percentage discount to delivery fee only
          deliveryDiscount += (deliveryFee * coupon.percentage / 100);
          break;
          case 'delivery-free':
          // Legacy/typo category seen in DB: treat like REFERRAL50 (percentage off delivery fee)
          deliveryDiscount += (deliveryFee * coupon.percentage / 100);
          break;
        case 'restaurant-fee':
          // Applies percentage discount to entire order for specific restaurant
          // Check if any cart items are from the coupon's restaurant
          const hasMatchingRestaurant = cartItems.some(item => item.restaurant_id === coupon.restaurant_id);
          if (hasMatchingRestaurant) {
            subtotalDiscount += (subtotal * coupon.percentage / 100);
          }
          break;
        case 'dev-fee':
          // Makes the entire order $0 for testing purposes
          subtotalDiscount += subtotal;
          deliveryDiscount += deliveryFee;
          break;
        case 'item-fee':
          // Applies discount to specific item in specific restaurant
          cartItems.forEach(item => {
            if (item.id === coupon.menu_item && item.restaurant_id === coupon.restaurant_id) {
              subtotalDiscount += (item.price * item.quantity * coupon.percentage / 100);
            }
          });
          break;
        default:
          // Fallback for any other category types - apply to subtotal
          subtotalDiscount += (subtotal * coupon.percentage / 100);
      }
    });
    
    totalDiscount = deliveryDiscount + subtotalDiscount;
    return { deliveryDiscount, subtotalDiscount, totalDiscount };
  }, [activeCoupons, deliveryFee, subtotal, cartItems, referralPromoEnabled, referralReward]);
  const finalDeliveryFee = Math.max(0, deliveryFee - discounts.deliveryDiscount);
  const finalSubtotal = Math.max(0, subtotal - discounts.subtotalDiscount);
  const finalTax = 0.08875 * finalSubtotal;
  // Calculate transaction fee: 2.9% of subtotal + $0.30
  const transactionFee = (finalSubtotal * transactionFeeRate) + transactionFeeFixed;
  const total = finalSubtotal + finalDeliveryFee + finalTax + transactionFee;
  const isInTab = route.name === 'Cart';

  // Fetch user's redeemed/available coupons (automatically applied). Dedupe by coupon_id so each coupon applies only once.
  const fetchUserCoupons = async () => {
    if (!session?.user) return;
    
    const { data, error } = await supabase
      .from('coupons_usage')
      .select('*, coupons(*)')
      .eq('user_id', session.user.id)
      .in('status', ['redeemed', 'available']);
    
    if (!error && data && data.length > 0) {
      // One row per coupon_id — prevents same coupon applying 2x, 3x, etc.
      const seen = new Set();
      const deduped = data.filter((cu) => {
        const cid = cu.coupon_id;
        if (seen.has(cid)) return false;
        seen.add(cid);
        return true;
      });
      setAppliedCoupons(deduped);
      // If a coupon was just redeemed/selected by code, pick that specific coupon.
      // Otherwise keep whatever the user previously selected (even if that means no coupon).
      setSelectedCouponUsageId((prev) => {
        if (pendingSelectedCouponId) {
          const match = deduped.find((cu) => cu.coupon_id === pendingSelectedCouponId);
          return match?.id ?? prev ?? null;
        }
        if (prev && deduped.some((cu) => cu.id === prev)) {
          return prev;
        }
        return null;
      });
      if (pendingSelectedCouponId) setPendingSelectedCouponId(null);
    } else if (!error) {
      setAppliedCoupons([]);
      setSelectedCouponUsageId(null);
      setPendingSelectedCouponId(null);
    }
  };

  // Fetch pending referral reward for current user
  const fetchReferralReward = async () => {
    if (!session?.user || !referralPromoEnabled) return;
    
    try {
      // Check if user has a pending referral reward (they referred someone but haven't used the reward yet)
      const { data, error } = await supabase
        .from('referral_usage')
        .select('*')
        .eq('referrer_user_id', session.user.id)
        .eq('referrer_rewarded', false)
        .single();
      
      if (!error && data) {
        setReferralReward(data);
      } else {
        setReferralReward(null);
      }
    } catch (err) {
      console.log('No pending referral reward');
      setReferralReward(null);
    }
  };

  // Validate and apply club code
  const handleApplyClubCode = async () => {
    if (!clubInput.trim()) {
      Alert.alert('Error', 'Please enter a club code');
      return;
    }

    setValidatingClub(true);
    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('*')
        .eq('club_code', clubInput.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        Alert.alert('Invalid Code', 'This club code does not exist or is inactive');
        setValidatingClub(false);
        return;
      }

      setSupportingClub(data);
      setClubInput('');
      setClubExpanded(false);
    } catch (err) {
      console.error('Club validation error:', err);
      Alert.alert('Error', 'Failed to validate club code');
    } finally {
      setValidatingClub(false);
    }
  };

  // Clear club support
  const handleClearClub = () => {
    setSupportingClub(null);
    setClubExpanded(false);
    setClubInput('');
  };

  // Unapply coupons for this cart session (no stacking).
  // If the user removes the active coupon, we do NOT want another one to "pop in" automatically.
  // This does not delete anything from the DB — it only clears what's applied in the UI for now.
  const removeAppliedCoupon = () => {
    setSelectedCouponUsageId(null);
    setPendingSelectedCouponId(null);
  };

  // Redeem coupon code
  const redeemCoupon = async () => {
    if (!couponCode.trim()) {
      Alert.alert('Error', 'Please enter a coupon code');
      return;
    }

    if (!session?.user) {
      Alert.alert('Error', 'Please sign in to redeem coupons');
      return;
    }

    setRedeemingCoupon(true);

    try {
      console.log('Attempting to redeem coupon:', couponCode.trim().toUpperCase());
      
      // Check if coupon exists and is valid
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('coupon_code', couponCode.trim().toUpperCase())
        .single();

      console.log('Coupon query result:', { coupon, couponError });

      if (couponError || !coupon) {
        console.log('Coupon not found or error:', couponError);
        Alert.alert('Invalid Coupon', 'This coupon code does not exist');
        setRedeemingCoupon(false);
        return;
      }

      // Validate coupon: check if valid and not expired
      const now = new Date();
      const endDate = new Date(coupon.end_at);
      
      if (!coupon.valid) {
        Alert.alert('Invalid Coupon', 'This coupon is no longer valid');
        setRedeemingCoupon(false);
        return;
      }

      if (now > endDate) {
        Alert.alert('Expired Coupon', 'This coupon has expired');
        setRedeemingCoupon(false);
        return;
      }

      // Check if user already has this coupon (any usage row) — don't insert duplicates
      const { data: existingRows, error: existingError } = await supabase
        .from('coupons_usage')
        .select('*, coupons(*)')
        .eq('user_id', session.user.id)
        .eq('coupon_id', coupon.id)
        .in('status', ['redeemed', 'available']);

      if (!existingError && existingRows && existingRows.length > 0) {
        // User already has this coupon - set it as the active selection directly
        // We use existingRows[0].id (the coupons_usage.id) not coupon.id (the coupons.id)
        setSelectedCouponUsageId(existingRows[0].id);
        setCouponCode('');
        setRedeemingCoupon(false);
        Alert.alert('Coupon Applied', 'Your coupon has been applied to the cart.');
        return;
      }

      // Special handling for REFERRAL50 coupon - check coupon_uses_remaining
      if (coupon.coupon_code === 'REFERRAL50') {
        const { data: referralCodeData, error: refCodeError } = await supabase
          .from('user_referral_codes')
          .select('coupon_uses_remaining')
          .eq('user_id', session.user.id)
          .single();
        
        if (!refCodeError && referralCodeData) {
          const usesRemaining = referralCodeData.coupon_uses_remaining || 0;
          if (usesRemaining <= 0) {
            Alert.alert('Coupon Limit Reached', 'You have no remaining uses for the REFERRAL50 coupon. Refer more friends to earn more uses!');
            setRedeemingCoupon(false);
            return;
          }
        } else {
          Alert.alert('Error', 'Unable to validate coupon. Please try again.');
          setRedeemingCoupon(false);
          return;
        }
      }

      // Check if user has reached their max usage for this coupon (skip for dev-fee and REFERRAL50)
      if (coupon.category !== 'dev-fee' && coupon.max_usage && coupon.coupon_code !== 'REFERRAL50') {
        const { data: userUsageData } = await supabase
          .from('coupons_usage')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('coupon_id', coupon.id)
          .in('status', ['redeemed', 'applied']);
        const userUsageCount = userUsageData?.length || 0;
        if (userUsageCount >= coupon.max_usage) {
          Alert.alert('Coupon Limit Reached', `You have already used this coupon ${coupon.max_usage} time(s). Max usage per user: ${coupon.max_usage}`);
          setRedeemingCoupon(false);
          return;
        }
      }

      // Add coupon to user's account with "redeemed" status
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // Coupon expires in 30 days

      console.log('Inserting coupon usage:', {
        user_id: session.user.id,
        coupon_id: coupon.id,
        status: 'redeemed',
        redeemed_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      });

      // Try to insert, but handle the case where user already has coupons
      const { error: insertError } = await supabase
        .from('coupons_usage')
        .insert({
          user_id: session.user.id,
          coupon_id: coupon.id,
          status: 'redeemed',
          redeemed_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        });

      console.log('Insert result:', { insertError });

      if (insertError) {
        console.log('Insert error details:', insertError);
        
        // If it's a duplicate key error, check if it's the same coupon
        if (insertError.code === '23505') {
          // Check if user already has this specific coupon
          const { data: existingCoupon, error: checkError } = await supabase
            .from('coupons_usage')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('coupon_id', coupon.id)
            .single();

          if (existingCoupon) {
            Alert.alert('Already Redeemed', 'You have already redeemed this coupon');
            setRedeemingCoupon(false);
            return;
          } else {
            // This is a different coupon but user_id constraint is blocking
            Alert.alert('Error', 'Database constraint error. Please contact support.');
            setRedeemingCoupon(false);
            return;
          }
        }
        
        Alert.alert('Error', 'Failed to redeem coupon. Please try again.');
        setRedeemingCoupon(false);
        return;
      }

      Alert.alert('Success!', `Coupon "${couponCode}" has been redeemed!`);
      setCouponCode('');
      setPendingSelectedCouponId(coupon.id);
      fetchUserCoupons(); // Refresh user coupons to immediately apply the discount
    } catch (error) {
      console.error('Coupon redemption error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setRedeemingCoupon(false);
    }
  };

  // Fetch available delivery times based on current day
  const fetchAvailableTimeSlots = async () => {
    try {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      // Convert day of week to match database format
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = dayNames[dayOfWeek];
      
      // Fetch ALL delivery times first (not filtered by day due to trailing space issue)
      const { data, error } = await supabase
        .from('delivery_times')
        .select('*')
        .order('hours', { ascending: true });
      
      if (error) {
        console.error('Error fetching delivery times:', error);
        // Fallback to hardcoded times if database fails
        const fallbackTimes = [
          { id: 1, hours: 10, minutes: 0, ampm: 'AM', counter: 0 },
          { id: 2, hours: 11, minutes: 0, ampm: 'AM', counter: 0 },
          { id: 3, hours: 12, minutes: 0, ampm: 'PM', counter: 0 },
          { id: 4, hours: 1, minutes: 0, ampm: 'PM', counter: 0 },
          { id: 5, hours: 2, minutes: 0, ampm: 'PM', counter: 0 },
          { id: 6, hours: 3, minutes: 0, ampm: 'PM', counter: 0 }
        ];
        setAvailableTimeSlots(fallbackTimes);
        return;
      }
      
      // Filter for current day (with trim to handle trailing spaces in database)
      let todaySlots = (data || []).filter(slot => slot.day?.trim() === currentDay);
      // Only show slots that have at least one deliverer assigned (rider-powered availability)
      todaySlots = todaySlots.filter(slot => (slot.max_capacity_lu ?? 0) > 0);

      // Filter out times that are too close to current time (less than 1 hour 45 minutes)
      const currentTime = new Date();
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      
      const filteredTimes = todaySlots.filter(timeSlot => {
        const hours = parseInt(timeSlot.hours);
        const minutes = parseInt(timeSlot.minutes) || 0;
        const ampm = timeSlot.ampm;
        
        // Convert slot time to 24-hour format
        let slotHour = hours;
        if (ampm === 'PM' && hours !== 12) {
          slotHour = hours + 12;
        } else if (ampm === 'AM' && hours === 12) {
          slotHour = 0;
        }
        
        // Calculate time difference in minutes
        const slotMinutes = slotHour * 60 + minutes;
        const currentMinutes = currentHour * 60 + currentMinute;
        const timeDifference = slotMinutes - currentMinutes;
        
        // Hide slots that are less than 1 hour and 45 minutes away (105 minutes)
        // Example: If current time is 2:15 PM and slot is 3:00 PM (45 min away), hide it
        // But if current time is 1:30 PM and slot is 3:00 PM (90 min away), show it
        return timeDifference >= 105; // 105 minutes = 1 hour 45 minutes
      });
      
      setAvailableTimeSlots(filteredTimes);
    } catch (error) {
      console.error('Error in fetchAvailableTimeSlots:', error);
      // Fallback to hardcoded times
      const fallbackTimes = [
        { id: 1, hours: 10, minutes: 0, ampm: 'AM', counter: 0 },
        { id: 2, hours: 11, minutes: 0, ampm: 'AM', counter: 0 },
        { id: 3, hours: 12, minutes: 0, ampm: 'PM', counter: 0 },
        { id: 4, hours: 1, minutes: 0, ampm: 'PM', counter: 0 },
        { id: 5, hours: 2, minutes: 0, ampm: 'PM', counter: 0 },
        { id: 6, hours: 3, minutes: 0, ampm: 'PM', counter: 0 }
      ];
      setAvailableTimeSlots(fallbackTimes);
    }
  };

  // Use availableTimeSlots from database instead of hardcoded times
  const filteredTimeSlots = availableTimeSlots;

  // Check if time slots and location are available
  const hasTimeSlots = selectedTimeSlot !== null;
  const hasLocation = selectedLocation !== null;
  const canPlaceOrder = hasTimeSlots && hasLocation;

  const hasAvailableTimeSlots = availableTimeSlots.length > 0;
  const isOrderAllowed = serviceOpen && (timeOverride || (canPlaceOrder && hasAvailableTimeSlots));
  const canUseInstantPay = instantPayEnabled && canPlaceOrder;

  const handleTimeSlotSelected = (windowData) => {
    // windowData contains: customerWindowLabel, earliestSlot, availableCapacity
    setSelectedTimeSlot(windowData.earliestSlot); // Store the earliest slot for display
    setSelectedTime(windowData.customerWindowLabel); // Store the window label
    setShowTimeSlotModal(false);
    setUserHasManuallySelectedTime(true); // Mark that user has manually chosen
    setDeliveryEstimate(null); // Clear auto-selection estimate
    
    // Store the customer window label for backend assignment
    setSelectedTimeSlot(prev => ({
      ...windowData.earliestSlot,
      customerWindowLabel: windowData.customerWindowLabel
    }));
  };

  const handleLocationSelected = (location) => {
    setSelectedLocation(location);
    setShowLocationModal(false);
  };

  const formatTime = (timeSlot) => {
    const hour = timeSlot.hours;
    const minute = timeSlot.minutes ? timeSlot.minutes.toString().padStart(2, '0') : '00';
    const ampm = timeSlot.ampm;
    return `${hour}:${minute} ${ampm}`;
  };

  // Validate restaurant(s) still active and delivery slot still has capacity before placing order
  const validateOrderCanProceed = useCallback(async () => {
    const restaurantIds = [...new Set((cartItems || []).map((item) => item.restaurant_id).filter(Boolean))];
    if (restaurantIds.length === 0) {
      return { valid: false, errorMessage: 'Your cart has no valid items. Please go back and add items again.' };
    }
    const { data: restaurants, error: restError } = await supabase
      .from('restaurant_master')
      .select('restaurant_id, active')
      .in('restaurant_id', restaurantIds);
    if (restError) {
      return { valid: false, errorMessage: 'Could not verify restaurants. Please try again.' };
    }
    const activeMap = new Map((restaurants || []).map((r) => [r.restaurant_id, r.active === true]));
    for (const id of restaurantIds) {
      if (!activeMap.get(id)) {
        return { valid: false, errorMessage: 'A restaurant in your order is no longer available. Please go back to home and choose another.' };
      }
    }
    if (selectedTimeSlot?.id) {
      const { data: slot, error: slotError } = await supabase
        .from('delivery_times')
        .select('id, max_capacity_lu')
        .eq('id', selectedTimeSlot.id)
        .single();
      if (slotError || !slot || (slot.max_capacity_lu ?? 0) <= 0) {
        return { valid: false, errorMessage: 'Your selected delivery time is no longer available. Please go back and choose another time.' };
      }
    }
    return { valid: true };
  }, [cartItems, selectedTimeSlot?.id]);

  // Helper function to split cart items by restaurant and create separate orders
  const createOrdersByRestaurant = async (user, orderCode, paymentIntentId, paymentStatus = 'paid') => {
    // Group cart items by restaurant
    const ordersByRestaurant = cartItems.reduce((acc, item) => {
      // Get restaurant info from the cart item (should now be properly set)
      const restaurantId = item.restaurant_id;
      const restaurantName = item.restaurant_name;
      
      if (!restaurantId) {
        console.error('Cart item missing restaurant_id:', item);
        throw new Error('Cart item is missing restaurant information. Please try adding items again.');
      }
      
      if (!acc[restaurantId]) {
        acc[restaurantId] = {
          restaurant_id: restaurantId,
          restaurant_name: restaurantName,
          items: [],
          subtotal: 0
        };
      }
      
      acc[restaurantId].items.push(item);
      acc[restaurantId].subtotal += item.price * item.quantity;
      return acc;
    }, {});

    const createdOrders = [];
    
    // Create separate order for each restaurant
    for (const [restaurantIdKey, restaurantOrder] of Object.entries(ordersByRestaurant)) {
      const deliveryFee = 0.20 * restaurantOrder.subtotal;
      const tax = 0.08875 * restaurantOrder.subtotal;
      const restaurantTransactionFee = (restaurantOrder.subtotal * transactionFeeRate) + transactionFeeFixed;
      const restaurantTotal = restaurantOrder.subtotal + deliveryFee + tax + restaurantTransactionFee;
      
      // Generate order code for each restaurant order (just use the base order code)
      const restaurantOrderCode = orderCode;
      
      // Validate restaurant_id is a proper integer
      const restaurantIdInt = parseInt(restaurantOrder.restaurant_id);
      if (isNaN(restaurantIdInt)) {
        throw new Error(`Invalid restaurant_id: ${restaurantOrder.restaurant_id}`);
      }
      
      // Insert order into orders table
      const orderInsertData = {
        user_id: user.id,
        restaurant_id: restaurantIdInt, // Ensure it's a proper integer
        restaurant_name: restaurantOrder.restaurant_name,
        items: restaurantOrder.items,
        total: restaurantTotal,
        status: paymentStatus,
        payment_status: paymentStatus,
        payment_intent_id: paymentIntentId,
        delivery_date: selectedDate.toISOString().split('T')[0],
        order_code: restaurantOrderCode,
        delivery_location: selectedLocation?.location || "Main Entrance - City College",
        delivery_time: selectedTimeSlot?.id || null,
      };
      
      const { data: orderData, error: orderError } = await supabase.from('orders').insert([orderInsertData]).select().single();

      if (orderError) {
        console.error(`Error creating order for restaurant ${restaurantOrder.restaurant_name}:`, orderError);
        throw new Error(`Failed to create order for ${restaurantOrder.restaurant_name}`);
      }

      // Insert status into order_status table
      const { error: statusError } = await supabase.from('order_status').insert([
        {
          order_id: orderData.id,
          status: 'submitted',
        },
      ]);

      if (statusError) {
        console.error(`Error creating status for order ${orderData.id}:`, statusError);
      }

      // Notify deliverers + admins that a new order was submitted (MVP)
      // Exclude the order placer from notifications (they shouldn't get notified about their own order)
      try {
        const title = 'New Order Submitted';
        const body = `Order #${orderData.order_code} from ${orderData.restaurant_name} ($${Number(orderData.total || 0).toFixed(2)})`;
        const payload = {
          type: 'order_submitted',
          title,
          body,
          data: {
            orderId: orderData.id,
            orderCode: orderData.order_code,
            restaurantName: orderData.restaurant_name,
            total: orderData.total,
          },
        };
        // Fire and forget; don't block checkout
        // Exclude the order placer (user.id) from notifications
        notificationService.notifyDeliverers(payload, user.id);
        notificationService.notifyAdmins(payload, user.id);
      } catch (notifErr) {
        console.error('Error sending submitted broadcast notifications:', notifErr);
      }

      // Track club order if club support is enabled and selected
      if (clubSupportEnabled && supportingClub) {
        try {
          // Commission is calculated from delivery fee, not total order
          const commissionAmount = (deliveryFee * supportingClub.commission_percentage) / 100;
          await supabase.from('club_orders').insert([
            {
              club_id: supportingClub.id,
              order_id: orderData.id,
              user_id: user.id,
              order_total: restaurantTotal,
              commission_amount: commissionAmount,
              commission_percentage: supportingClub.commission_percentage,
            },
          ]);
          console.log(`Club order tracked for ${supportingClub.club_name} - Commission: $${commissionAmount.toFixed(2)} from delivery fee: $${deliveryFee.toFixed(2)}`);
        } catch (clubErr) {
          console.error('Error tracking club order:', clubErr);
          // Don't block order completion if club tracking fails
        }
      }

      // Mark referral reward as used ONLY if REFERRAL50 coupon was actually applied
      if (referralPromoEnabled && referralReward && activeCoupons.length > 0) {
        try {
          // Check if REFERRAL50 was one of the applied coupons
          const usedReferral50 = activeCoupons.some(cu => cu.coupons?.coupon_code === 'REFERRAL50');
          
          if (usedReferral50) {
            await supabase
              .from('referral_usage')
              .update({ referrer_rewarded: true })
              .eq('id', referralReward.id);
            console.log('Referral reward marked as used (REFERRAL50 applied)');
          }
        } catch (refErr) {
          console.error('Error updating referral reward:', refErr);
          // Don't block order completion if referral update fails
        }
      }

      createdOrders.push(orderData);
    }

    return createdOrders;
  };

  // Apple Pay handler function (deprecated in favor of PaymentSheet)
  const handleApplePay = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert('Error', 'Please sign in to use Apple Pay');
        return;
      }

      // Generate order code for Apple Pay
      const newOrderCode = Math.floor(100000 + Math.random() * 900000);
      const totalCents = Math.round(total * 100); // Convert to cents

      // Check if total is $0 (free order due to coupons) - bypass Apple Pay
      if (total <= 0) {
        try {
          const user = session.user;

          // Create separate orders for each restaurant
          const createdOrders = await createOrdersByRestaurant(user, newOrderCode, `free_order_${newOrderCode}`, 'paid');

          // Update delivery time counter
          if (selectedTimeSlot) {
            await supabase
              .from('delivery_times')
              .update({ counter: selectedTimeSlot.counter + 1 })
              .eq('id', selectedTimeSlot.id);
          }

          // Mark applied coupons as used
          if (activeCoupons.length > 0) {
            try {
              const appliedCouponIds = activeCoupons.map((couponUsage) => couponUsage.id);
              await supabase
                .from('coupons_usage')
                .update({ 
                  status: 'applied',
                  applied_at: new Date().toISOString()
                })
                .in('id', appliedCouponIds);
            } catch (err) {
              console.error('Error updating coupon status:', err);
            }
          }

          clearCart();
          
          // Navigate to OrderPreparing screen
          navigation.navigate('OrderPreparing', {
            orderCode: newOrderCode,
            cartItems: cartItems,
            subtotal: finalSubtotal,
            deliveryFee: finalDeliveryFee,
            tax: finalTax,
            restaurant: createdOrders[0]?.restaurant_name || 'Restaurant'
          });
          return;
        } catch (error) {
          console.error('Error processing free order:', error);
          Alert.alert('Error', 'Failed to process order. Please contact support.');
          return;
        }
      }

      console.log('Apple Pay - Creating payment intent with data:', {
        cartItems: cartItems.length,
        total: total,
        totalCents: totalCents,
        orderCode: newOrderCode,
        restaurant: restaurant?.name
      });

      // Create payment intent with Apple Pay configuration using direct fetch
      const token = session.access_token;
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || 'https://pgouwzuufnnhthwrewrv.functions.supabase.co'}/create-payment-intent`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          cartItems, 
          restaurant, 
          amount: totalCents, // Send cents as integer
          currency: 'usd',
          orderCode: newOrderCode,
          customerWindowLabel: selectedTimeSlot?.customerWindowLabel || null,
          requiredLoad: cartLoad.totalScore,
          metadata: {
            order_type: 'apple_pay',
            user_id: session.user.id,
            restaurant_id: restaurant.restaurant_id,
            restaurant_name: restaurant.restaurant_name,
            items_count: cartItems.length.toString(), // Just count, not full items
            delivery_time: selectedTimeSlot?.id || null,
            delivery_location: selectedLocation?.location || "Main Entrance - City College",
            delivery_date: selectedDate.toISOString().split('T')[0],
            applied_coupons_count: activeCoupons.length.toString() // Just count, not full coupons
          }
        }),
      });

      const data = await response.json();
      
      console.log('Apple Pay - Payment intent response:', { data, status: response.status });

      if (!response.ok) {
        console.error('Payment intent creation failed:', data);
        Alert.alert('Payment Error', `Failed to create payment intent: ${data.message || 'Unknown error'}`);
        return;
      }

      const { client_secret } = data;
      
      // Initialize PaymentSheet (Apple Pay will be available inside the sheet)
      const { error: initError } = await initPaymentSheet({
        merchantId: 'merchant.com.qbdelivery.quickbitesdelivery',
        customerId: session.user.id,
        paymentIntentClientSecret: client_secret,
        merchantCountryCode: 'US',
        applePay: {
          merchantId: 'merchant.com.qbdelivery.quickbitesdelivery',
          merchantCountryCode: 'US',
        },
        returnURL: 'com.srahin000.quickbites://stripe-redirect',
        allowsDelayedPaymentMethods: true,
      });

      if (initError) {
        console.error('Payment sheet init error:', initError);
        Alert.alert('Payment Error', 'Failed to initialize Apple Pay. Please try again.');
        return;
      }

      // Present PaymentSheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        console.error('Payment presentation error:', presentError);
        Alert.alert('Payment Failed', 'Payment was cancelled or failed. Please try again.');
        return;
      }

      // Handle successful payment
      await handleSuccessfulApplePayPayment(client_secret, newOrderCode);
      
    } catch (error) {
      console.error('Apple Pay error:', error);
      Alert.alert('Payment Failed', error.message || 'An unexpected error occurred. Please try again.');
    }
  };

  // Handle successful Apple Pay payment
  const handleSuccessfulApplePayPayment = async (clientSecret, orderCode) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session.user;

      // Create separate orders for each restaurant
      const createdOrders = await createOrdersByRestaurant(user, orderCode, clientSecret, 'paid');

      // Update delivery time counter
      if (selectedTimeSlot) {
        await supabase
          .from('delivery_times')
          .update({ counter: selectedTimeSlot.counter + 1 })
          .eq('id', selectedTimeSlot.id);
      }

      // Mark applied coupons as used
      if (activeCoupons.length > 0) {
        try {
          const appliedCouponIds = activeCoupons.map((couponUsage) => couponUsage.id);
          await supabase
            .from('coupons_usage')
            .update({ 
              status: 'applied',
              applied_at: new Date().toISOString()
            })
            .in('id', appliedCouponIds);
        } catch (err) {
          console.error('Error updating coupon status:', err);
        }
      }

      clearCart();
      
      // Navigate to OrderPreparing screen
      navigation.navigate('OrderPreparing', {
        orderCode: orderCode,
        cartItems: cartItems,
        subtotal: finalSubtotal,
        deliveryFee: finalDeliveryFee,
        tax: finalTax,
        restaurant: createdOrders[0]?.restaurant_name || 'Restaurant'
      });
      
    } catch (error) {
      console.error('Error processing Apple Pay order:', error);
      Alert.alert('Error', 'Failed to process order. Please contact support.');
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Add logic to reload cart data if needed
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  useEffect(() => {
    const fetchServiceStatus = async () => {
      const { data: prodStatus, error: prodError } = await supabase
        .from('service_approval')
        .select('open')
        .eq('id', 1)
        .single();
  
      const { data: devStatus, error: devError } = await supabase
        .from('service_approval')
        .select('open')
        .eq('id', 2)
        .single();

      const { data: timeOverrideStatus, error: timeOverrideError } = await supabase
        .from('service_approval')
        .select('open')
        .eq('id', 3)
        .single();

      const { data: referralPromoStatus, error: referralError } = await supabase
        .from('service_approval')
        .select('open')
        .eq('id', 4)
        .single();

      const { data: clubSupportStatus, error: clubError } = await supabase
        .from('service_approval')
        .select('open')
        .eq('id', 5)
        .single();
  
      if (prodError) console.error('Error fetching prod status:', prodError);
      else setServiceOpen(prodStatus.open);
  
      if (devError) console.error('Error fetching dev status:', devError);
      else {
        setShowDevPay(!devStatus.open); // 👈 if dev "open" = true, hide Dev Pay
        setInstantPayEnabled(devStatus.open); // 👈 if ID 2 "open" = true, enable instant pay
      }

      if (timeOverrideError) console.error('Error fetching time override status:', timeOverrideError);
      else setTimeOverride(timeOverrideStatus.open); // 👈 if ID 3 "open" = true, bypass time restrictions

      if (referralError) console.error('Error fetching referral promo status:', referralError);
      else setReferralPromoEnabled(referralPromoStatus.open); // 👈 if ID 4 "open" = true, enable referral promo

      if (clubError) console.error('Error fetching club support status:', clubError);
      else setClubSupportEnabled(clubSupportStatus.open); // 👈 if ID 5 "open" = true, enable club support
    };
  
    fetchServiceStatus();
  }, []);

  useEffect(() => {
    // Show dev pay button after 5 seconds
    const timer = setTimeout(() => {
      setShowDevPay(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Fetch user's redeemed coupons
    fetchUserCoupons();
    // Fetch referral reward if enabled
    if (referralPromoEnabled) {
      fetchReferralReward();
    }
  }, [session, referralPromoEnabled]);

  useEffect(() => {
    // Clear coupon selection when cart becomes empty
    if (cartItems.length === 0) {
      setSelectedCouponUsageId(null);
    }
  }, [cartItems.length]);

  useEffect(() => {
    // Fetch available delivery time slots
    fetchAvailableTimeSlots();
  }, []);

  // Fetch smart delivery slot based on cart load (only if user hasn't manually selected)
  useEffect(() => {
    const fetchSmartDeliverySlot = async () => {
      // Don't auto-select if user has manually picked a time
      if (userHasManuallySelectedTime) {
        return;
      }

      if (cartItems.length === 0 || cartLoad.totalScore === 0) {
        setDeliveryEstimate(null);
        setIsShopFull(false);
        return;
      }

      setLoadingSlot(true);
      try {
        const { data, error } = await supabase
          .rpc('find_next_available_slot', { required_load: cartLoad.totalScore });

        if (error) {
          // PGRST202 = function not in schema (run supabase/find_next_available_slot.sql in SQL Editor)
          if (error.code === 'PGRST202') {
            setDeliveryEstimate(null);
            setIsShopFull(false);
          } else {
            console.error('Error finding available slot:', error);
          }
          setLoadingSlot(false);
          return;
        }

        if (!data) {
          // Shop is at full capacity
          setIsShopFull(true);
          setDeliveryEstimate(null);
        } else {
          setIsShopFull(false);
          setDeliveryEstimate(data);
        }
      } catch (err) {
        console.error('Error in fetchSmartDeliverySlot:', err);
      } finally {
        setLoadingSlot(false);
      }
    };

    // Debounce the call slightly to avoid excessive RPC calls
    const timer = setTimeout(() => {
      fetchSmartDeliverySlot();
    }, 500);

    return () => clearTimeout(timer);
  }, [cartLoad.totalScore, cartItems.length, userHasManuallySelectedTime]);

  // Check if selected slot has capacity for current cart load
  useEffect(() => {
    const checkSlotCapacity = async () => {
      // Only check if we have a manually selected time slot
      if (!selectedTimeSlot?.id || !userHasManuallySelectedTime) {
        return;
      }

      if (cartItems.length === 0 || cartLoad.totalScore === 0) {
        setIsShopFull(false);
        setOrderBlockError(null);
        return;
      }

      try {
        // Fetch current slot data
        const { data: slotData, error: slotError } = await supabase
          .from('delivery_times')
          .select('id, max_capacity_lu, current_load_lu')
          .eq('id', selectedTimeSlot.id)
          .single();

        if (slotError) {
          console.error('Error checking slot capacity:', slotError);
          return;
        }

        if (!slotData || (slotData.max_capacity_lu ?? 0) <= 0) {
          // Slot no longer available
          setIsShopFull(true);
          return;
        }

        const availableCapacity = (slotData.max_capacity_lu ?? 0) - (slotData.current_load_lu ?? 0);
        
        // Check if cart load fits in available capacity
        if (cartLoad.totalScore > availableCapacity) {
          setIsShopFull(true);
        } else {
          setIsShopFull(false);
          // Clear the error if capacity is now sufficient
          if (orderBlockError?.message?.includes('delivery time is no longer available')) {
            setOrderBlockError(null);
          }
        }
      } catch (err) {
        console.error('Error in checkSlotCapacity:', err);
      }
    };

    checkSlotCapacity();
  }, [cartLoad.totalScore, selectedTimeSlot?.id, userHasManuallySelectedTime, cartItems.length]);

  // If cart becomes empty (Clear All or last-item minus), close any modal and go back to menu
  useEffect(() => {
    const prev = prevCartCountRef.current;
    const next = cartItems.length;

    if (prev > 0 && next === 0) {
      setShowTimeSlotModal(false);
      setShowLocationModal(false);
      setSelectedTimeSlot(null);
      setSelectedLocation(null);
      setUserHasManuallySelectedTime(false); // Reset manual selection flag when cart clears

      // Tab cart: send user back to browse (Home tab)
      navigation.navigate('MainTabs', { screen: 'Home' });
    }

    prevCartCountRef.current = next;
  }, [cartItems.length, navigation]);

  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <View className="flex-1 justify-center items-center px-6 py-12 bg-white">
          <View className="items-center">
            <View className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center mb-6">
                <Icon.ShoppingCart size={48} color={themeColors.purple} />
            </View>
            <Text className="text-xl font-semibold text-gray-600 mb-2">
              Your cart is empty
            </Text>
            <Text className="text-gray-500 text-center px-8 mb-8">
              Start adding delicious items to your cart
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: themeColors.purple }} edges={['top', 'left', 'right']}>
      {orderBlockError && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: 'white',
              borderRadius: 20,
              padding: 28,
              maxWidth: 340,
              width: '100%',
              alignItems: 'center',
            }}
          >
            <Icon.AlertCircle width={56} height={56} stroke="#EF4444" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 12 }}>
              Cannot complete order
            </Text>
            <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>
              {orderBlockError.message}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setOrderBlockError(null);
                navigation.navigate('MainTabs', { screen: 'Home' });
              }}
              style={{
                backgroundColor: themeColors.purple,
                paddingVertical: 14,
                paddingHorizontal: 28,
                borderRadius: 12,
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Go back to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <StatusBar style="light" />
      {/* Purple Header - compact, with title on left and clear button on right */}
      <View
        style={{
          backgroundColor: themeColors.purple,
          paddingTop: 18,
          paddingBottom: 18,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '800', fontSize: 32}}>Your Cart</Text>
        {cartItems.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Clear Cart',
                'Are you sure you want to remove all items from your cart?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: clearCart },
                ]
              );
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.16)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.9}
          >
            <Icon.Trash2 width={18} height={18} stroke="white" strokeWidth={2.4} />
          </TouchableOpacity>
        )}
      </View>
      {/* Main Content (light grey background) */}
      <View style={{ flex: 1, backgroundColor: pageBg }}>
        {/* Removed Order Items header section - cards will overlap header */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 50 }}
          style={{ paddingTop: 0 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Cart Items */}
          {cartItems.length > 0 && (
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              {cartItems.map((item, index) => {
                const customizations = formatCustomizationLine(item.customizations);
                const isFirst = index === 0;
                // Create unique key combining item ID, name, and customizations
                const uniqueKey = `${item.id || item.name}-${JSON.stringify(item.customizations)}-${index}`;
                return (
                  <View
                    key={uniqueKey}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: 16,
                      padding: 20,
                      marginBottom: 18,
                      marginTop: isFirst ? 4 : 0,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: isFirst ? 0.08 : 0.04,
                      shadowRadius: isFirst ? 16 : 12,
                      elevation: isFirst ? 5 : 3,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 }}>
                          {item.name}
                        </Text>
                        {customizations ? (
                          <Text style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 4 }}>
                            {customizations}
                          </Text>
                        ) : null}
                        <Text style={{ fontSize: 14, color: '#6B7280' }}>
                          ${parseFloat(item.price).toFixed(2)} each
                        </Text>
                      </View>
                      {/* Refined Quantity Picker - smaller, vertically centered */}
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                          onPress={() => removeFromCart(item)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: '#F9FAFB',
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon.Minus width={14} height={14} stroke="#6B7280" strokeWidth={2.5} />
                        </TouchableOpacity>
                        <Text style={{ marginHorizontal: 12, fontSize: 17, fontWeight: '700', color: '#111827', minWidth: 24, textAlign: 'center' }}>
                          {item.quantity}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            // Check if adding this item would exceed slot capacity
                            const potentialLoad = cartLoad.totalScore + (item.load_unit || 0);
                            if (selectedTimeSlot && potentialLoad > slotCapacity) {
                              Alert.alert(
                                'Order Capacity Exceeded',
                                'Your order exceeds the selected slot capacity. Your order will be assigned to the next available slot at the next hour.',
                                [{ text: 'OK', onPress: () => {} }]
                              );
                              return;
                            }
                            addToCart(item, {
                              restaurant_id: item.restaurant_id,
                              restaurant_name: item.restaurant_name,
                              id: item.restaurant_id,
                              name: item.restaurant_name
                            });
                          }}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: '#F9FAFB',
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon.Plus width={14} height={14} stroke={themeColors.purple} strokeWidth={2.5} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF2F7', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: '#6B7280' }}>Total for this item</Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                        ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Applied Coupons */}
          {cartItems.length > 0 && activeCoupons.length > 0 && (
            <View style={{ paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Applied Coupons</Text>
              {activeCoupons.map((couponUsage, index) => {
                const coupon = couponUsage.coupons;
                if (!coupon) return null;
                const isReferred = coupon.coupon_code === 'REFERRED';
                const bgColor = isReferred ? themeColors.purple + '15' : '#F0FDF4'; // Purple with low opacity or light green
                const borderColor = isReferred ? themeColors.purple + '40' : '#BBF7D0';
                const textColor = isReferred ? themeColors.purple : '#166534';
                const descColor = isReferred ? themeColors.purple + 'CC' : '#16A34A';
                
                return (
                  <View
                    key={couponUsage.id || index}
                    style={{
                      backgroundColor: bgColor,
                      borderRadius: 16,
                      padding: 20,
                      marginBottom: 18,
                      borderWidth: 1,
                      borderColor: borderColor,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.04,
                      shadowRadius: 12,
                      elevation: 3,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: textColor, marginBottom: 4 }}>
                          {coupon.coupon_code}
                        </Text>
                        <Text style={{ fontSize: 14, color: descColor }}>
                          {coupon.category === 'delivery-fee' ? 'Free Delivery' : 
                           coupon.category === 'restaurant-fee' ? `${coupon.percentage}% Off Restaurant` :
                           coupon.category === 'dev-fee' ? 'Free Order (Testing)' :
                           coupon.category === 'item-fee' ? `${coupon.percentage}% Off Specific Item` :
                           `${coupon.percentage}% Off`}
                        </Text>
                        {coupon.title && (
                          <Text style={{ fontSize: 13, color: descColor, marginTop: 4 }}>{coupon.title}</Text>
                        )}
                      </View>
                      {/* 44x44pt X button target */}
                      <TouchableOpacity
                        onPress={removeAppliedCoupon}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: 'rgba(0, 0, 0, 0.3)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        activeOpacity={0.7}
                      >
                        <Icon.X width={18} height={18} stroke="white" strokeWidth={3} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Load Capacity Warning - only show after time slot is selected */}
          {cartItems.length > 0 && selectedTimeSlot && loadWarning.message && (
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={{ 
                backgroundColor: loadWarning.bgColor,
                borderRadius: 12,
                padding: 16,
                borderLeftWidth: 4,
                borderLeftColor: loadWarning.color
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon.AlertCircle size={20} color={loadWarning.color} />
                  <Text style={{ 
                    fontSize: 14, 
                    fontWeight: '600', 
                    color: loadWarning.color, 
                    marginLeft: 8,
                    flex: 1
                  }}>
                    Order size may cause delays based on current capacity
                  </Text>
                </View>
                <Text style={{ 
                  fontSize: 12, 
                  color: loadWarning.color, 
                  marginTop: 6,
                  opacity: 0.8
                }}>
                  Larger orders may be assigned to later delivery slots if capacity is exceeded.
                </Text>
              </View>
            </View>
          )}

          {/* Order Summary */}
          {cartItems.length > 0 && (
            <View style={{ paddingHorizontal: 16 }}>
              <View
                style={{
                  backgroundColor: 'white',
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 18,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.04,
                  shadowRadius: 12,
                  elevation: 3,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 }}>
                  Order Summary
                </Text>
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#6B7280' }}>Subtotal</Text>
                    <Text style={{ fontSize: 13, color: '#374151', fontWeight: '600', textAlign: 'right' }}>
                      ${subtotal.toFixed(2)}
                    </Text>
                  </View>
                  
                  {/* Discounts (coupon or referral reward) */}
                  {(discounts.subtotalDiscount > 0 || discounts.deliveryDiscount > 0) && (
                    <>
                      {discounts.subtotalDiscount > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 13, color: '#16A34A' }}>Subtotal Discount</Text>
                          <Text style={{ fontSize: 13, color: '#16A34A', fontWeight: '600', textAlign: 'right' }}>
                            -${discounts.subtotalDiscount.toFixed(2)}
                          </Text>
                        </View>
                      )}
                      {discounts.deliveryDiscount > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 13, color: '#16A34A' }}>Delivery Discount</Text>
                          <Text style={{ fontSize: 13, color: '#16A34A', fontWeight: '600', textAlign: 'right' }}>
                            -${discounts.deliveryDiscount.toFixed(2)}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#6B7280' }}>Delivery Fee (20%)</Text>
                    <Text style={{ fontSize: 13, color: '#374151', fontWeight: '600', textAlign: 'right' }}>
                      ${deliveryFee.toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#6B7280' }}>Tax (8.875%)</Text>
                    <Text style={{ fontSize: 13, color: '#374151', fontWeight: '600', textAlign: 'right' }}>
                      ${finalTax.toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#6B7280' }}>Transaction Fee</Text>
                    <Text style={{ fontSize: 13, color: '#374151', fontWeight: '600', textAlign: 'right' }}>
                      ${transactionFee.toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ borderTopWidth: 1, borderTopColor: '#EEF2F7', paddingTop: 12, marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>Total</Text>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'right' }}>
                        ${total.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Coupon Redemption Section */}
              <View
                style={{
                  backgroundColor: 'white',
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 18,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.04,
                  shadowRadius: 12,
                  elevation: 3,
                }}
              >
                <View className="flex-row items-center mb-3">
                  <Icon.Tag size={20} color={themeColors.purple} />
                  <Text className="text-lg font-semibold text-gray-800 ml-2">Have a Coupon?</Text>
                </View>
                
                <Text className="text-gray-600 text-sm mb-3">
                  Enter your coupon code to unlock discounts
                </Text>
                
                <View className="flex-row items-center">
                  <TextInput
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mr-3 text-gray-800"
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChangeText={setCouponCode}
                    autoCapitalize="characters"
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity
                    onPress={redeemCoupon}
                    disabled={redeemingCoupon || !couponCode.trim()}
                    style={{
                      backgroundColor: redeemingCoupon || !couponCode.trim() ? '#D1D5DB' : themeColors.purple,
                      borderRadius: 12,
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                    }}
                  >
                    {redeemingCoupon ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={{ color: 'white', fontWeight: '600' }}>Redeem</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Club Support Section */}
              {clubSupportEnabled && (
                <View
                  style={{
                    backgroundColor: 'white',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 18,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.04,
                    shadowRadius: 12,
                    elevation: 3,
                  }}
                >
                  {!supportingClub && !clubExpanded && (
                    // Default State - collapsed
                    <TouchableOpacity
                      onPress={() => setClubExpanded(true)}
                      className="flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center">
                        <Icon.Heart size={20} color={themeColors.purple} />
                        <Text className="text-gray-700 ml-2">Supporting a club? Enter code.</Text>
                      </View>
                      <Icon.ChevronRight size={16} color="#6B7280" />
                    </TouchableOpacity>
                  )}

                  {!supportingClub && clubExpanded && (
                    // Active State - expanded with input
                    <View>
                      <View className="flex-row items-center mb-3">
                        <Icon.Heart size={20} color={themeColors.purple} />
                        <Text className="text-lg font-semibold text-gray-800 ml-2">Support a Club</Text>
                      </View>
                      <Text className="text-gray-600 text-sm mb-3">
                        Enter a 4-character club code to support them with your order
                      </Text>
                      <View className="flex-row items-center">
                        <TextInput
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mr-3 text-gray-800"
                          placeholder="Club Code (e.g., EWB)"
                          value={clubInput}
                          onChangeText={(text) => setClubInput(text.toUpperCase())}
                          autoCapitalize="characters"
                          maxLength={4}
                          placeholderTextColor="#9CA3AF"
                        />
                        <TouchableOpacity
                          onPress={handleApplyClubCode}
                          disabled={validatingClub || clubInput.trim().length !== 4}
                          style={{
                            backgroundColor: validatingClub || clubInput.trim().length !== 4 ? '#D1D5DB' : themeColors.purple,
                            borderRadius: 12,
                            paddingHorizontal: 20,
                            paddingVertical: 12,
                          }}
                        >
                          {validatingClub ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <Text style={{ color: 'white', fontWeight: '600' }}>Support</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setClubExpanded(false);
                          setClubInput('');
                        }}
                        className="mt-3"
                      >
                        <Text className="text-gray-500 text-sm text-center">Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {supportingClub && (
                    // Success State - showing badge
                    <View>
                      <View className="flex-row items-center justify-between bg-purple-50 rounded-lg p-3 border border-purple-200">
                        <View className="flex-row items-center flex-1">
                          <Icon.Heart size={20} color={themeColors.purple} fill={themeColors.purple} />
                          <View className="ml-3 flex-1">
                            <Text className="text-purple-900 font-semibold">Supporting {supportingClub.club_name}!</Text>
                            <Text className="text-purple-700 text-xs mt-1">
                              {supportingClub.commission_percentage}% of delivery fee supports this club
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={handleClearClub}
                          className="ml-2 w-6 h-6 rounded-full bg-gray-200 items-center justify-center"
                        >
                          <Icon.X size={14} color="#6B7280" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Delivery Information */}
              <View
                style={{
                  backgroundColor: 'white',
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 18,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.04,
                  shadowRadius: 12,
                  elevation: 3,
                }}
              >
                <Text className="text-lg font-semibold text-gray-800 mb-3">Delivery Information</Text>
                
                <View className="space-y-3">
                  <View>
                    <Text className="text-sm text-gray-500 mb-1">Date</Text>
                    <Text className="text-gray-800">{selectedDate.toDateString()}</Text>
                  </View>
                  
                  <View>
                    <Text className="text-sm text-gray-500 mb-2">Time</Text>
                    <TouchableOpacity
                      onPress={() => setShowTimeSlotModal(true)}
                      className="border border-gray-200 rounded-lg px-3 py-3 bg-white flex-row items-center justify-between"
                    >
                      <View>
                        <Text className="text-gray-900">
                          {selectedTimeSlot ? formatTime(selectedTimeSlot) : 'Select time'}
                        </Text>
                        {selectedTimeSlot && (
                          <Text className="text-gray-500 text-xs">
                            {selectedTimeSlot.counter}/10 orders • {selectedTimeSlot.counter >= 10 ? 'Full' : 'Available'}
                          </Text>
                        )}
                      </View>
                      <Icon.ChevronRight size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <View>
                    <Text className="text-sm text-gray-500 mb-2">Location</Text>
                    <TouchableOpacity
                      onPress={() => setShowLocationModal(true)}
                      className="border border-gray-200 rounded-lg px-3 py-3 bg-white flex-row items-center justify-between"
                    >
                      <View>
                        <Text className="text-gray-900">
                          {selectedLocation ? selectedLocation.location : 'Select location'}
                        </Text>
                        {selectedLocation && (
                          <Text className="text-gray-500 text-xs">
                            {selectedLocation.address || selectedLocation.description}
                          </Text>
                        )}
                      </View>
                      <Icon.ChevronRight size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

          {/* Smart Delivery Estimate / Shop Full Warning */}
          {cartItems.length > 0 && selectedTimeSlot && (
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              {loadingSlot ? (
                <View style={{ 
                  backgroundColor: '#F3F4F6',
                  borderRadius: 12,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ActivityIndicator size="small" color={themeColors.purple} />
                  <Text style={{ marginLeft: 8, color: '#6B7280', fontSize: 13 }}>
                    Finding optimal delivery slot...
                  </Text>
                </View>
              ) : isShopFull ? (
                <View style={{ 
                  backgroundColor: '#FEE2E2',
                  borderRadius: 12,
                  padding: 16,
                  borderLeftWidth: 4,
                  borderLeftColor: '#DC2626'
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon.AlertTriangle size={20} color="#DC2626" />
                    <Text style={{ 
                      fontSize: 14, 
                      fontWeight: '600', 
                      color: '#DC2626', 
                      marginLeft: 8,
                      flex: 1
                    }}>
                      Maximum Capacity Reached
                    </Text>
                  </View>
                  <Text style={{ 
                    fontSize: 12, 
                    color: '#DC2626', 
                    marginTop: 6,
                    opacity: 0.8
                  }}>
                    All delivery slots are full. Please check back later or reduce your order size.
                  </Text>
                </View>
              ) : loadWarning?.level === 'heavy' ? (
                <View style={{ 
                  backgroundColor: loadWarning.bgColor,
                  borderRadius: 12,
                  padding: 16,
                  borderLeftWidth: 4,
                  borderLeftColor: loadWarning.color
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon.AlertTriangle size={20} color={loadWarning.color} />
                    <Text style={{ 
                      fontSize: 14, 
                      fontWeight: '600', 
                      color: loadWarning.color, 
                      marginLeft: 8,
                      flex: 1
                    }}>
                      {loadWarning.message}
                    </Text>
                  </View>
                  <Text style={{ 
                    fontSize: 12, 
                    color: loadWarning.color, 
                    marginTop: 6,
                    opacity: 0.8
                  }}>
                    Your order requires multiple delivery trips. Items will arrive separately.
                  </Text>
                </View>
              ) : loadWarning?.level === 'large' ? (
                <View style={{ 
                  backgroundColor: loadWarning.bgColor,
                  borderRadius: 12,
                  padding: 16,
                  borderLeftWidth: 4,
                  borderLeftColor: loadWarning.color
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon.AlertCircle size={20} color={loadWarning.color} />
                    <Text style={{ 
                      fontSize: 14, 
                      fontWeight: '600', 
                      color: loadWarning.color, 
                      marginLeft: 8,
                      flex: 1
                    }}>
                      {loadWarning.message}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          )}

          {!isOrderAllowed ? (
            <Text className="text-red-500 text-center text-sm mt-3">
              {!canPlaceOrder ? 
                'Please select time and location' :
                !hasAvailableTimeSlots ?
                  'No delivery times available for today' :
                  'Service unavailable. Check Instagram for updates.'
              }
            </Text>
          ) : canPlaceOrder ? (
            <View className="mt-4 space-y-4">
              {/* Payment Section Header */}
              <View className="mb-2">
                <Text className="text-lg font-semibold text-gray-800 text-center mb-4">
                  Choose Payment Method
                </Text>
              </View>

              {/* Present Stripe PaymentSheet (Apple Pay shows as an option if available) */}
              <View className="space-y-2">
              {/* Place Order Button */}
              {canUseInstantPay ? (
                <TouchableOpacity
                  onPress={async () => {
                    const validation = await validateOrderCanProceed();
                    if (!validation.valid) {
                      setOrderBlockError({ message: validation.errorMessage });
                      return;
                    }
                    const instantCode = Math.floor(100000 + Math.random() * 900000);
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.user) return;
                    const user = session.user;

                    // Create separate orders for each restaurant
                    const createdOrders = await createOrdersByRestaurant(user, instantCode, `instant_${instantCode}`, 'pending');

                    clearCart();
                    
                    // Navigate to OrderPreparing screen
                    navigation.navigate('OrderPreparing', {
                      orderCode: instantCode,
                      cartItems: cartItems,
                      subtotal: finalSubtotal,
                      deliveryFee: finalDeliveryFee,
                      tax: finalTax,
                      restaurant: createdOrders[0]?.restaurant_name || 'Restaurant'
                    });
                  }}
                  className="w-full"
                  disabled={isShopFull}
                >
                  <View style={{ 
                    backgroundColor: isShopFull ? '#9CA3AF' : '#10b981',
                    opacity: isShopFull ? 0.5 : 1
                  }} className="rounded-xl p-3">
                    {isShopFull ? (
                      <Text className="text-lg font-semibold text-white text-center">
                        Shop Full - Check Back Later
                      </Text>
                    ) : (
                      <Text className="text-lg font-semibold text-white text-center">
                        💳 Instant Pay
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                onPress={async () => {
                  const validation = await validateOrderCanProceed();
                  if (!validation.valid) {
                    setOrderBlockError({ message: validation.errorMessage });
                    return;
                  }
                  let newOrderCode;
                  let isUnique = false;

                  while (!isUnique) {
                    newOrderCode = Math.floor(100000 + Math.random() * 900000);
                  
                    const startOfDay = new Date();
                    startOfDay.setHours(0, 0, 0, 0);
                  
                    const endOfDay = new Date();
                    endOfDay.setHours(23, 59, 59, 999);
                  
                    const { data: existingOrders, error: fetchError } = await supabase
                      .from('orders')
                      .select('order_code, created_at')
                      .gte('created_at', startOfDay.toISOString())
                      .lte('created_at', endOfDay.toISOString());
                  
                    if (fetchError) {
                      console.error('Fetch error:', fetchError);
                      break;
                    }
                  
                    const usedCodes = existingOrders.map(order => order.order_code);
                    if (!usedCodes.includes(newOrderCode.toString())) isUnique = true;
                  }

                  // Check if total is $0 (free order due to coupons)
                  if (total <= 0) {
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session?.user) return;
                      const user = session.user;

                      // Create separate orders for each restaurant
                      const createdOrders = await createOrdersByRestaurant(user, newOrderCode, `free_order_${newOrderCode}`, 'paid');

                      // Update delivery time counter
                      if (selectedTimeSlot) {
                        await supabase
                          .from('delivery_times')
                          .update({ counter: selectedTimeSlot.counter + 1 })
                          .eq('id', selectedTimeSlot.id);
                      }

                      // Mark applied coupons as used
                      if (activeCoupons.length > 0) {
                        try {
                          const appliedCouponIds = activeCoupons.map((couponUsage) => couponUsage.id);
                          await supabase
                            .from('coupons_usage')
                            .update({ 
                              status: 'applied',
                              applied_at: new Date().toISOString()
                            })
                            .in('id', appliedCouponIds);
                        } catch (err) {
                          console.error('Error updating coupon status:', err);
                        }
                      }

                      clearCart();
                      
                      // Navigate to OrderPreparing screen
                      navigation.navigate('OrderPreparing', {
                        orderCode: newOrderCode,
                        cartItems: cartItems,
                        subtotal: finalSubtotal,
                        deliveryFee: finalDeliveryFee,
                        tax: finalTax,
                        restaurant: createdOrders[0]?.restaurant_name || 'Restaurant'
                      });
                      return;
                    } catch (error) {
                      console.error('Error processing free order:', error);
                      Alert.alert('Error', 'Failed to process order. Please contact support.');
                      return;
                    }
                  }

                  try {
                    // Get current session
                    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
                    
                    if (sessionError || !currentSession?.user) {
                      console.error('Session error:', sessionError);
                      return Alert.alert('Authentication Error', 'Please sign in again to continue.');
                    }

                    // Verify and refresh token if needed by calling getUser (this auto-refreshes expired tokens)
                    const { data: { user }, error: userError } = await supabase.auth.getUser();
                    
                    if (userError || !user) {
                      console.error('User verification error:', userError);
                      
                      // Check if it's a token refresh error (invalid refresh token - likely signed out from another device)
                      const isTokenRefreshError = userError?.message?.includes('refresh_token') || 
                                                  userError?.message?.includes('JWT') || 
                                                  userError?.message?.includes('expired') ||
                                                  userError?.message?.includes('Invalid') ||
                                                  userError?.status === 401;
                      
                      if (isTokenRefreshError) {
                        return Alert.alert(
                          'Session Expired', 
                          'You were signed out from another device. Please sign in again to continue.',
                          [
                            { 
                              text: 'OK', 
                              onPress: () => {
                                // Optionally navigate to sign in screen
                                // navigation.navigate('Signin');
                              }
                            }
                          ]
                        );
                      }
                      
                      return Alert.alert('Authentication Error', 'Your session has expired. Please sign in again.');
                    }

                    // Get the latest session after potential refresh
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    
                    if (!token) {
                      return Alert.alert('Authentication Error', 'Please sign in again to continue.');
                    }

                    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || 'https://pgouwzuufnnhthwrewrv.functions.supabase.co'}/create-payment-intent`, {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ 
                        cartItems, 
                        restaurant, 
                        total, 
                        orderCode: newOrderCode,
                        customerWindowLabel: selectedTimeSlot?.customerWindowLabel || null,
                        requiredLoad: cartLoad.totalScore
                      }),
                    });

                    const data = await response.json();
                    
                    if (!response.ok) {
                      console.error('Payment intent creation failed:', {
                        status: response.status,
                        statusText: response.statusText,
                        error: data.error,
                        message: data.message,
                        details: data.details
                      });
                      
                      // Check if it's an authentication error (401)
                      if (response.status === 401 || data.error === 'Invalid or expired token') {
                        return Alert.alert(
                          'Session Expired', 
                          'You were signed out from another device. Please sign in again to continue.',
                          [
                            { 
                              text: 'OK', 
                              onPress: () => {
                                // Optionally navigate to sign in screen
                                // navigation.navigate('Signin');
                              }
                            }
                          ]
                        );
                      }
                      
                      return Alert.alert(
                        'Payment Error', 
                        data.message || data.error || 'Failed to create payment. Please try again.',
                        [{ text: 'OK' }]
                      );
                    }

                    const { client_secret, paymentIntentId } = data;
                    
                    if (!client_secret) {
                      return Alert.alert('Payment Error', 'Invalid payment response. Please try again.');
                    }
                    

                    const { error: initError } = await initPaymentSheet({
                      paymentIntentClientSecret: client_secret,
                      merchantDisplayName: 'QuickBites',
                      merchantCountryCode: 'US',
                      applePay: {
                        merchantId: 'merchant.com.qbdelivery.quickbitesdelivery',
                        merchantCountryCode: 'US',
                      },
                      returnURL: 'com.srahin000.quickbites://stripe-redirect',
                    });

                    if (initError) {
                      return Alert.alert('Payment Setup Error', `Failed to initialize payment: ${initError.message}`);
                    }

                    const { error: presentError } = await presentPaymentSheet();

                    if (presentError) {
                      
                      if (presentError.code === 'Canceled') {
                        return Alert.alert('Payment Cancelled', 'You cancelled the payment.');
                      }
                      return Alert.alert('Payment Failed', presentError.message);
                    }

                    // Create separate orders for each restaurant
                    const createdOrders = await createOrdersByRestaurant(user, newOrderCode, paymentIntentId, 'paid');

                    // Increment the time slot counter after successful payment
                    if (selectedTimeSlot?.id) {
                      try {
                        const { error: counterError } = await supabase
                          .from('delivery_times')
                          .update({ counter: selectedTimeSlot.counter + 1 })
                          .eq('id', selectedTimeSlot.id);

                        if (counterError) {
                          console.error('Error updating time slot counter:', counterError);
                          // Don't show error to user as payment was successful
                        } else {
                          console.log('Time slot counter incremented successfully');
                        }
                      } catch (err) {
                        console.error('Error updating time slot counter:', err);
                        // Don't show error to user as payment was successful
                      }
                    }

                    // Mark applied coupons as used
                    if (activeCoupons.length > 0) {
                      try {
                        const appliedCouponIds = activeCoupons.map((couponUsage) => couponUsage.id);
                        const { error: couponError } = await supabase
                          .from('coupons_usage')
                          .update({ 
                            status: 'applied',
                            applied_at: new Date().toISOString()
                          })
                          .in('id', appliedCouponIds);

                        if (couponError) {
                          // Don't show error to user as payment was successful
                        } else {
                        }
                      } catch (err) {
                        // Don't show error to user as payment was successful
                      }
                    }

                    clearCart();
                    
                    // Navigate to OrderPreparing screen
                    navigation.navigate('OrderPreparing', {
                      orderCode: newOrderCode,
                      cartItems: cartItems,
                      subtotal: finalSubtotal,
                      deliveryFee: finalDeliveryFee,
                      tax: finalTax,
                      restaurant: createdOrders[0]?.restaurant_name || 'Restaurant'
                    });
                  } catch (error) {
                    console.error('Payment error:', error);
                    Alert.alert('Network error', error.message);
                  }
                }}
                className="w-full"
                disabled={isShopFull}
              >
                <View style={{ 
                  backgroundColor: isShopFull ? '#9CA3AF' : themeColors.purple,
                  opacity: isShopFull ? 0.5 : 1
                }} className="rounded-xl p-3">
                  {loadingSlot ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                      <ActivityIndicator size="small" color="white" />
                      <Text style={{ text: 'Checking Capacity...', color: 'white', fontSize: 16, textAlign: 'center' }}>
                        Checking capacity...
                      </Text>
                    </View>
                  ) : isShopFull ? (
                    <Text style={{ text: 'Shop Full - Check Back Later', color: 'white', fontSize: 16, textAlign: 'center' }}>
                      Shop Full - Check Back Later
                    </Text>
                  ) : selectedTimeSlot ? (
                    <View>
                      <Text style={{ text: 'Order for ' + formatTime(selectedTimeSlot), color: 'white', fontSize: 16, textAlign: 'center' }}>
                        Order for {formatTime(selectedTimeSlot)}
                      </Text>
                    </View>
                  ) : deliveryEstimate?.estimated_time ? (
                    <View>
                      <Text style={{ text: 'Order for ' + deliveryEstimate.estimated_time, color: 'white', fontSize: 16, textAlign: 'center' }}>
                        Order for {deliveryEstimate.estimated_time}
                      </Text>
                      {deliveryEstimate.is_delayed && (
                        <Text style={{ text: 'Next available slot', color: 'white', fontSize: 12, textAlign: 'center', opacity: 0.8 }}>
                          Next available slot
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={{ text: 'Place Order', color: 'white', fontSize: 16, textAlign: 'center' }}>
                      Place Order
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
              )}
              
              </View>
            </View>
          ) : null}
        </View>
      )}
        </ScrollView>
      </View>
      
      {/* Time Slot Modal */}
      <TimeSlotModal
        visible={showTimeSlotModal}
        onClose={() => setShowTimeSlotModal(false)}
        onTimeSelected={handleTimeSlotSelected}
        restaurantId={restaurant?.id}
        timeOverride={timeOverride}
      />

      {/* Location Modal */}
      <LocationModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSelected={handleLocationSelected}
        restaurantId={restaurant?.id}
      />
    </SafeAreaView>
  );
}
