import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Clock, Tag, User, LogOut, ArrowLeft, MapPin, ChevronRight, Download, Upload, Plus, Minus, CheckCircle2, Search, Menu, Camera, Phone, Lock, ArrowRight, ShieldCheck, Wallet, Heart, Truck, MessageCircle, Moon, Sun, Star, Globe, Gift, Repeat, Calendar, AlertTriangle, Users, Mic, Bell, XCircle, Store, Navigation, Printer, Bike } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import CustomerSupportChat from './components/CustomerSupportChat';
import OrderChatModal from './components/OrderChatModal'; 

// ✅ BASE URL UPDATE (AWS)
const API_BASE_URL = "http://Foodiee-backend-env.eba-5d9p6wzb.eu-north-1.elasticbeanstalk.com";

// --- CUSTOM ANIMATED BIKE ICON FOR LEAFLET MAP ---
const getAnimatedBikeIcon = (rotationAngle) => {
  return new L.DivIcon({
    className: 'custom-animated-bike',
    html: `
      <div style="transform: rotate(${rotationAngle}deg); transition: transform 0.8s linear; width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
        <div style="background: linear-gradient(135deg, #fc8019, #f59e0b); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 10px rgba(252,128,25,0.5);">
          <span style="font-size: 20px;">🛵</span>
        </div>
      </div>
    `,
    iconSize: [45, 45],
    iconAnchor: [22, 22],
  });
};

// --- MAP UPDATER HELPER ---
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (center) map.setView(center, 15);
  }, [center, map]);
  return null;
}

// --- SHOP BANNER AUTO-SLIDER COMPONENT ---
function ShopBannerSlider({ selectedShop }) {
  const allShopImages = [
    selectedShop.imageUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
    ...(selectedShop.additionalImages || [])
  ];

  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (allShopImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % allShopImages.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [allShopImages.length]);

  return (
    <div className="w-full h-48 rounded-3xl overflow-hidden relative border border-slate-700 shadow-xl bg-slate-950 group">
      {allShopImages.map((img, idx) => (
        <div 
          key={idx} 
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${idx === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
        >
          <img src={img} alt={`Slide ${idx}`} className="w-full h-full object-cover" />
        </div>
      ))}

      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent z-20"></div>

      <div className="absolute bottom-3 left-4 right-4 z-30 flex justify-between items-end">
        <div>
          <h3 className="text-base font-black text-white drop-shadow-md">{selectedShop.name}</h3>
          <p className="text-[11px] text-slate-300 font-medium">{selectedShop.address} • {selectedShop.rating}</p>
        </div>

        {allShopImages.length > 1 && (
          <div className="flex gap-1.5 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
            {allShopImages.map((_, i) => (
              <span 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-300 ${i === currentSlide ? 'w-4 bg-[#fc8019]' : 'w-1.5 bg-white/50'}`}
              ></span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('userMobile') ? true : false;
  });
  const [isRegisterView, setIsRegisterView] = useState(false);
  
  // --- OTP LOGIN STATES ---
  const [step, setStep] = useState(1);
  const [generatedOtpHint, setGeneratedOtpHint] = useState('');
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // --- UNREAD CHAT COUNT & BLINKING DOT STATES ---
  const [unreadSupportCount, setUnreadSupportCount] = useState(0); 
  const [unreadOrderCount, setUnreadOrderCount] = useState(0); 

  // Form States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpInput, setOtpInput] = useState('');

  const [activeTab, setActiveTab] = useState('home');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedShop, setSelectedShop] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [cart, setCart] = useState([]);

  // --- QUICK ACTION & FOOD TYPE FILTER STATES ---
  const [quickFilter, setQuickFilter] = useState('All');
  const [foodTypeFilter, setFoodTypeFilter] = useState('All');

  // --- EDIT PROFILE MODAL STATES ---
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [editProfileName, setEditProfileName] = useState('');

  // --- WALLET HISTORY & SCRATCH CARD MODAL STATES ---
  const [isWalletHistoryOpen, setIsWalletHistoryOpen] = useState(false);
  const [scratchCards, setScratchCards] = useState(() => {
    const saved = localStorage.getItem('foodiee_saved_scratch_cards');
    return saved !== null ? JSON.parse(saved) : [];
  });
  const [activeScratchCard, setActiveScratchCard] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);
  const canvasRef = useRef(null);

  // --- ORDER CHAT STATES ---
  const [activeChatRecipient, setActiveChatRecipient] = useState(null); 

  // --- BACKEND DYNAMIC FOOD, SHOPS & ORDERS STATE WITH AUTO POLLING ---
  const [backendFoodItems, setBackendFoodItems] = useState([]);
  const [allShops, setAllShops] = useState([]);
  const [backendOrders, setBackendOrders] = useState([]);
  const [userPhoto, setUserPhoto] = useState('https://api.dicebear.com/7.x/avataaars/svg?seed=Naveen');

  // --- DYNAMIC PROMO CODES & POP-UP STATES ---
  const [availablePromos, setAvailablePromos] = useState([
    { code: 'FIRST50', discount: '₹50 OFF', minOrder: 199, isActive: true }
  ]);
  const [promoPopup, setPromoPopup] = useState(null);

  // --- NOTIFICATIONS STATE ---
  const [notifications, setNotifications] = useState([
    { id: 1, title: '⚡ Flash Offer Added!', desc: 'Use code FIRST50 for ₹50 OFF on your first food order.', time: 'Just now', unread: true },
    { id: 2, title: '🛒 Free Delivery', desc: 'Free delivery on all grocery orders above ₹199 in Ichapuram.', time: '2 hrs ago', unread: true }
  ]);

  useEffect(() => {
    localStorage.setItem('foodiee_saved_scratch_cards', JSON.stringify(scratchCards));
  }, [scratchCards]);

  useEffect(() => {
    const fetchActivePromos = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/promos/active`);
        if (res.ok) {
          const promos = await res.json();
          if (promos && promos.length > 0) {
            setAvailablePromos(promos);
            const latestPromo = promos[promos.length - 1];
            const seenPromos = JSON.parse(localStorage.getItem('foodiee_seen_promos') || '[]');
            
            if (!seenPromos.includes(latestPromo.code)) {
              setPromoPopup(latestPromo);
              setNotifications(prev => [
                {
                  id: Date.now(),
                  title: `🎉 New Offer: ${latestPromo.code}`,
                  desc: `Avail ${latestPromo.discount} on min order ₹${latestPromo.minOrder || 199}!`,
                  time: 'Just now',
                  unread: true
                },
                ...prev
              ]);
              seenPromos.push(latestPromo.code);
              localStorage.setItem('foodiee_seen_promos', JSON.stringify(seenPromos));
            }
          }
        }
      } catch (err) {
        console.error("Error fetching promo codes:", err);
      }
    };

    fetchActivePromos();
    const interval = setInterval(fetchActivePromos, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- WEBSOCKET LIVE BROADCAST & SUPPORT CHAT SYNC ---
  useEffect(() => {
    const userMob = phone || localStorage.getItem('userMobile');
    if (!userMob) return;

    const socket = new SockJS(`${API_BASE_URL}/ws-foodiee`);
    const stompClient = new Client({
      webSocketFactory: () => socket,
      onConnect: () => {
        // 1. Support Chat Subscriber
        stompClient.subscribe(`/topic/chat/${userMob}`, (message) => {
          const incoming = JSON.parse(message.body);
          if (incoming.senderType !== 'customer') {
            setUnreadSupportCount(prev => prev + 1);
            toast.success(`💬 న్యూ మెసేజ్ వచ్చింది: ${incoming.senderName || 'Support'}`);
          }
        });

        // 2. 🚀 Broadcast Push Notifications Subscriber (All Users / Customers)
        stompClient.subscribe('/topic/broadcast/all', (message) => {
          const broadcastData = JSON.parse(message.body);
          toast((t) => (
            <div className="space-y-1">
              <p className="font-black text-amber-400 text-xs">📢 Foodiee ప్రత్యేక ప్రకటన</p>
              <p className="text-xs text-white">{broadcastData.message}</p>
              {broadcastData.imageUrl && (
                <img src={`${API_BASE_URL}/${broadcastData.imageUrl}`} alt="Offer" className="w-full h-24 object-cover rounded-xl mt-1 shadow" />
              )}
            </div>
          ), { duration: 6000 });
        });

        stompClient.subscribe('/topic/broadcast/customers', (message) => {
          const broadcastData = JSON.parse(message.body);
          toast((t) => (
            <div className="space-y-1">
              <p className="font-black text-amber-400 text-xs">📢 కస్టమర్ స్పెషల్ అలర్ట్</p>
              <p className="text-xs text-white">{broadcastData.message}</p>
              {broadcastData.imageUrl && (
                <img src={`${API_BASE_URL}/${broadcastData.imageUrl}`} alt="Offer" className="w-full h-24 object-cover rounded-xl mt-1 shadow" />
              )}
            </div>
          ), { duration: 6000 });
        });
      }
    });

    stompClient.activate();
    return () => stompClient.deactivate();
  }, [phone]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const foodRes = await fetch(`${API_BASE_URL}/api/food/all`);
        if (foodRes.ok) {
          const foodData = await foodRes.json();
          setBackendFoodItems(foodData);
        }

        const shopRes = await fetch(`${API_BASE_URL}/api/shop/all`);
        if (shopRes.ok) {
          const shopData = await shopRes.json();
          setAllShops(shopData);
        }

        const userMob = phone || localStorage.getItem('userMobile');
        if (userMob && userMob.length === 10) {
          const orderRes = await fetch(`${API_BASE_URL}/api/orders/customer/${userMob}`);
          if (orderRes.ok) {
            const orderData = await orderRes.json();
            setBackendOrders(orderData);
          }

          const profileRes = await fetch(`${API_BASE_URL}/api/users/profile/${userMob}`);
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            if (profileData.profilePhoto) {
              setUserPhoto(profileData.profilePhoto);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [phone]); 

  const [darkMode, setDarkMode] = useState(true);
  const [isSupportChatOpen, setIsSupportChatOpen] = useState(false);

  const [ratingModal, setRatingModal] = useState(null);
  const [stars, setStars] = useState(5);
  const [reviewText, setReviewText] = useState('');

  const [riderTip, setRiderTip] = useState(0);
  const [splitPeople, setSplitPeople] = useState(1);

  const [activeTrackingOrder, setActiveTrackingOrder] = useState(null);
  const [riderLocation, setRiderLocation] = useState({ lat: 18.5793, lng: 84.4452 });
  const [deliveryBoyCoords, setDeliveryBoyCoords] = useState({ lat: 18.5793, lng: 84.4452 });

  useEffect(() => {
    if (!activeTrackingOrder) return;

    const socket = new SockJS(`${API_BASE_URL}/ws-foodiee`);
    const stompClient = new Client({
      webSocketFactory: () => socket,
      onConnect: () => {
        stompClient.subscribe(`/topic/location/${activeTrackingOrder.id || activeTrackingOrder.orderId}`, (message) => {
          const locationData = JSON.parse(message.body);
          const lat = locationData.lat !== undefined ? locationData.lat : locationData.latitude;
          const lng = locationData.lng !== undefined ? locationData.lng : locationData.longitude;
          
          const safeLat = (lat && lat > 18 && lat < 19) ? lat : 18.5793;
          const safeLng = (lng && lng > 84 && lng < 85) ? lng : 84.4452;

          setDeliveryBoyCoords({ lat: safeLat, lng: safeLng });
          setRiderLocation({ lat: safeLat, lng: safeLng });

          if (locationData.status) {
            setActiveTrackingOrder(prev => ({ ...prev, status: locationData.status }));
          }
        });

        // Order Specific Chat Listener
        stompClient.subscribe(`/topic/chat/${activeTrackingOrder.id || activeTrackingOrder.orderId}`, (message) => {
          const chatData = JSON.parse(message.body);
          if (chatData.senderType !== 'customer') {
            setUnreadOrderCount(prev => prev + 1);
            toast.success(`💬 న్యూ ఆర్డర్ మెసేజ్ వచ్చింది!`);
          }
        });
      },
    });

    stompClient.activate();
    return () => stompClient.deactivate();
  }, [activeTrackingOrder]);

  const [walletBalance, setWalletBalance] = useState(() => {
    const saved = localStorage.getItem('foodiee_wallet_balance');
    return saved !== null ? parseFloat(saved) : 0.00;
  });

  const [paymentHistory, setPaymentHistory] = useState(() => {
    const saved = localStorage.getItem('foodiee_payment_history');
    return saved !== null ? JSON.parse(saved) : [
      { id: '#PAY-901', type: 'CREDIT', method: 'Wallet Top-up (Razorpay)', amount: 140, date: '18 Aug 2026', status: 'Success' }
    ];
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mobile', phone || localStorage.getItem('userMobile'));

    try {
      toast.loading('Uploading profile photo...');
      const response = await fetch(`${API_BASE_URL}/api/users/upload-photo`, {
        method: "POST",
        body: formData,
      });

      toast.dismiss();

      if (response.ok) {
        const updatedUser = await response.json();
        setUserPhoto(updatedUser.profilePhoto);
        toast.success('✓ Profile photo saved to database successfully!');
      } else {
        toast.error('❌ Failed to upload photo to server.');
      }
    } catch (error) {
      toast.dismiss();
      toast.error('❌ Server connection error during photo upload.');
    }
  };

  const triggerScratchCard = (orderAmount) => {
    const rewardAmount = Math.floor(2 + Math.random() * 23);
    const timestamp = new Date().toLocaleString();

    const newCard = {
      id: Date.now(),
      amount: rewardAmount,
      isScratched: false,
      timestamp: timestamp
    };

    setScratchCards(prev => [newCard, ...prev]);
    toast.success('🎁 You unlocked a new Scratch Card! Check Offers & Rewards.');
  };

  const startScratch = (e) => {
    setIsDrawing(true);
    scratch(e);
  };

  const stopScratch = () => {
    setIsDrawing(false);
  };

  const scratch = (e) => {
    if (!isDrawing || !activeScratchCard || activeScratchCard.isScratched) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0].clientY) - rect.top;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    setScratchProgress(prev => Math.min(prev + 10, 100));
  };

  const claimScratchReward = () => {
    if (!activeScratchCard || activeScratchCard.isScratched) return;

    const amt = activeScratchCard.amount;
    const timestamp = new Date().toLocaleString();

    setWalletBalance(prev => prev + amt);
    
    setPaymentHistory(prev => [{
      id: "SCRATCH_" + Math.floor(100000 + Math.random() * 900000),
      type: 'CREDIT',
      method: `🎁 Scratch Card Win (₹${amt} Added)`,
      amount: amt,
      date: timestamp,
      status: 'Success'
    }, ...prev]);

    setScratchCards(prev => prev.map(c => c.id === activeScratchCard.id ? { ...c, isScratched: true } : c));
    setActiveScratchCard(null);
    setScratchProgress(0);
    toast.success(`🎉 Hurrah! ₹${amt} successfully credited to your wallet!`);
  };

  const [savedAddresses, setSavedAddresses] = useState(() => {
    const saved = localStorage.getItem('foodiee_multiple_addresses');
    return saved !== null ? JSON.parse(saved) : [
      { id: 1, type: 'Home', name: 'Bommali Naveen', mobile: '9123456789', houseNo: 'Door 2-45', street: 'Main Road', landmark: 'Near Temple', district: 'Ichapuram', state: 'Andhra Pradesh', latitude: 18.5793, longitude: 84.4452 }
    ];
  });

  const [address, setAddress] = useState(() => {
    const savedActive = localStorage.getItem('foodiee_active_address');
    if (savedActive !== null) return JSON.parse(savedActive);
    return savedAddresses[0] || {
      name: 'Bommali Naveen',
      mobile: '9123456789',
      houseNo: 'Door 2-45',
      street: 'Main Road',
      landmark: 'Near Temple',
      district: 'Ichapuram',
      state: 'Andhra Pradesh',
      pincode: '532484',
      latitude: 18.5793,
      longitude: 84.4452
    };
  });

  const [newAddressInput, setNewAddressInput] = useState({
    type: 'Home',
    name: 'Bommali Naveen',
    mobile: '9123456789',
    houseNo: '',
    street: '',
    landmark: '',
    district: 'Ichapuram',
    state: 'Andhra Pradesh',
    pincode: '532484',
    latitude: 18.5793,
    longitude: 84.4452
  });

  const detectGpsForNewAddress = () => {
    if (navigator.geolocation) {
      toast.loading('📍 Detecting live GPS location...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setNewAddressInput(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
            street: prev.street ? prev.street : `GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`
          }));
          toast.dismiss();
          toast.success('📍 GPS coordinates captured successfully!');
        },
        (error) => {
          toast.dismiss();
          toast.error('❌ GPS unavailable. Please enter complete address manually.');
        },
        { enableHighAccuracy: true }
      );
    } else {
      toast.error('❌ Geolocation not supported');
    }
  };

  const handleAddNewAddress = async (e) => {
    e.preventDefault();
    if (!newAddressInput.street.trim() || !newAddressInput.pincode.trim() || !newAddressInput.district.trim()) {
      toast.error('❌ Please fill complete address details');
      return;
    }

    const payload = {
      customerMobile: phone || localStorage.getItem('userMobile') || newAddressInput.mobile,
      ...newAddressInput
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/address/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const savedAddr = await response.json();
        setSavedAddresses(prev => [...prev, savedAddr]);
        setAddress(savedAddr);
        toast.success(`📍 ${newAddressInput.type} Complete Address Saved to Database with GPS!`);
        
        setNewAddressInput({ 
          type: 'Home', 
          name: address.name, 
          mobile: address.mobile, 
          houseNo: '',
          street: '', 
          landmark: '',
          district: 'Ichapuram', 
          state: 'Andhra Pradesh', 
          pincode: '532484', 
          latitude: 18.5793, 
          longitude: 84.4452 
        });
      } else {
        toast.error('❌ Failed to save address in database');
      }
    } catch (error) {
      console.error("Address save error:", error);
      toast.error('❌ Network error while saving address');
    }
  };

  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editableAddress, setEditableAddress] = useState(address);

  const detectLiveGpsLocation = () => {
    if (navigator.geolocation) {
      toast.loading('📍 Detecting live GPS location...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setEditableAddress(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
            street: `GPS Active (${lat.toFixed(4)}, ${lng.toFixed(4)})`
          }));
          toast.dismiss();
          toast.success('📍 Live GPS coordinates detected successfully!');
        },
        (error) => {
          toast.dismiss();
          toast.error('❌ GPS permission denied or unavailable.');
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleSaveEditedAddress = (e) => {
    e.preventDefault();
    setAddress(editableAddress);
    setIsEditingAddress(false);
    toast.success('✓ Delivery address updated successfully!');
  };

  useEffect(() => {
    localStorage.setItem('foodiee_wallet_balance', walletBalance);
  }, [walletBalance]);

  useEffect(() => {
    localStorage.setItem('foodiee_payment_history', JSON.stringify(paymentHistory));
  }, [paymentHistory]);

  useEffect(() => {
    localStorage.setItem('foodiee_multiple_addresses', JSON.stringify(savedAddresses));
  }, [savedAddresses]);

  useEffect(() => {
    localStorage.setItem('foodiee_active_address', JSON.stringify(address));
  }, [address]);

  const [isAddMoneyModalOpen, setIsAddMoneyModalOpen] = useState(false);
  const [addAmountInput, setAddAmountInput] = useState('');

  const handleRazorpayPayment = () => {
    const amount = parseFloat(addAmountInput);
    if (!amount || amount <= 0) {
      toast.error('❌ Please enter a valid amount');
      return;
    }

    const options = {
      key: "rzp_test_TTbofIebO8RB99",
      amount: amount * 100,
      currency: "INR",
      name: "Foodiee Delivery App",
      description: "Wallet Top-up for Ichapuram",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Foodiee",
      handler: async function (response) {
        const paymentId = response.razorpay_payment_id;
        await verifyAndSavePayment(paymentId, amount);
      },
      prefill: {
        name: address.name,
        email: "user@foodiee.com",
        contact: address.mobile
      },
      theme: {
        color: "#fc8019"
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const handleUpiPayment = (appName, type) => {
    const amount = parseFloat(addAmountInput);
    if (!amount || amount <= 0) {
      toast.error('❌ Please enter a valid amount');
      return;
    }
    const fakeTxnId = "TXN_" + Math.floor(100000 + Math.random() * 900000);
    verifyAndSavePayment(fakeTxnId, amount);
  };

  const verifyAndSavePayment = async (paymentId, amount) => {
    const paymentPayload = {
      transactionId: paymentId,
      customerMobile: address.mobile,
      totalAmount: amount,
      paymentMethod: 'Razorpay Online',
      paymentStatus: 'SUCCESS',
      shopId: selectedShop ? selectedShop.id : 1
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentPayload),
      });

      if (res.ok) {
        const savedTx = await res.json();
        setWalletBalance(prev => prev + amount);
        setPaymentHistory(prev => [{
          id: savedTx.transactionId || paymentId,
          type: 'CREDIT',
          method: 'Wallet Top-up (Razorpay)',
          amount: amount,
          date: 'Just now',
          status: 'Success'
        }, ...prev]);

        toast.success(`🎉 ₹ ${amount} added to wallet successfully!`);
        setIsAddMoneyModalOpen(false);
        setAddAmountInput('');
      } else {
        toast.error('❌ Failed to save payment in database');
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error('❌ Server connection error');
    }
  };

  const [favorites, setFavorites] = useState([]);
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);

  const [isPaymentScreen, setIsPaymentScreen] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const deliveryFee = subtotal > 0 ? 20 : 0;
  
  const totalAmount = Math.max(0, ((subtotal + deliveryFee) + riderTip) - discount);
  const splitAmount = (totalAmount / Math.max(1, splitPeople)).toFixed(2);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phone || phone.length !== 10 || !/^[6-9]\d{9}$/.test(phone)) {
      toast.error('❌ దయచేసి సరైన 10 అంకెల మొబైల్ నంబర్ ఇవ్వండి');
      return;
    }

    const fullMobile = `+91${phone}`;

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: fullMobile, role: 'customer' }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedOtpHint(data.otp || '1234');
        setStep(2);
        toast.success('📲 OTP విజయవంతంగా పంపబడింది!');
      } else {
        toast.error('❌ OTP పంపడం విఫలమైంది');
      }
    } catch (error) {
      toast.success('📲 OTP (Hint: 1234) జనరేట్ చేయబడింది!');
      setStep(2);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: phone, otp: otpInput, role: "customer" }),
      });

      if (response.ok) {
        const user = await response.json();
        
        localStorage.setItem('userMobile', user.mobile || phone);
        localStorage.setItem('userName', user.name || 'Customer');

        setAddress(prev => ({ ...prev, name: user.name || 'Customer', mobile: user.mobile || phone }));
        if (user.profilePhoto) {
          setUserPhoto(user.profilePhoto);
        }
        setIsLoggedIn(true);
        toast.success(`🎉 Welcome back, ${user.name || 'Customer'}! Login Successful.`);
      } else {
        toast.error('❌ Invalid OTP! Please check.');
      }
    } catch (error) {
      localStorage.setItem('userMobile', phone);
      localStorage.setItem('userName', name || 'Customer');
      setIsLoggedIn(true);
      toast.success('🎉 Login Successful!');
    }
  };

  const applyPromo = () => {
    if (!promoCode.trim()) return;

    const usedPromos = JSON.parse(localStorage.getItem('foodiee_used_promos') || '[]');
    if (usedPromos.includes(promoCode.toUpperCase())) {
      toast.error(`❌ Coupon ${promoCode.toUpperCase()} already used! Valid only once per customer.`);
      return;
    }

    const matched = availablePromos.find(p => p.code.toUpperCase() === promoCode.toUpperCase());
    if (matched) {
      setDiscount(50);
      toast.success(`🎁 Promo code ${matched.code} applied successfully!`);
    } else if (promoCode.toUpperCase() === 'FIRST50') {
      setDiscount(50);
      toast.success('🎁 Promo code applied! ₹50 OFF');
    } else {
      toast.error('❌ Invalid Promo Code');
    }
  };

  const processOrderCompletion = async (methodName) => {
    const orderItemsDesc = cart.map(i => `${i.qty}x ${i.name}`).join(', ');

    const newOrderPayload = {
      customerName: address.name,
      customerMobile: address.mobile || phone || localStorage.getItem('userMobile'),
      deliveryAddress: `${address.houseNo ? address.houseNo + ', ' : ''}${address.street}, ${address.landmark ? 'Near ' + address.landmark + ', ' : ''}${address.district}, ${address.state} - ${address.pincode}`,
      shopName: selectedShop ? selectedShop.name : 'Local Store',
      shopId: selectedShop ? selectedShop.id : 1,
      items: orderItemsDesc,
      totalAmount: totalAmount,
      deliveryFee: deliveryFee,
      paymentMethod: methodName,
      status: 'Pending Approval',
      shopLat: selectedShop?.lat || 18.5793,
      shopLng: selectedShop?.lng || 84.4452,
      customerLat: address.latitude || 18.5793,
      customerLng: address.longitude || 84.4452,
      orderTime: new Date().toISOString()
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/place`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOrderPayload),
      });

      if (response.ok) {
        const savedOrder = await response.json();

        if (discount > 0 && promoCode) {
          const usedPromos = JSON.parse(localStorage.getItem('foodiee_used_promos') || '[]');
          if (!usedPromos.includes(promoCode.toUpperCase())) {
            usedPromos.push(promoCode.toUpperCase());
            localStorage.setItem('foodiee_used_promos', JSON.stringify(usedPromos));
          }
        }

        if (methodName.includes('Wallet')) {
          const debitPayload = {
            transactionId: "WAL_DEBIT_" + Math.floor(100000 + Math.random() * 900000),
            customerMobile: address.mobile,
            totalAmount: totalAmount,
            paymentMethod: 'Wallet Deduction',
            paymentStatus: 'SUCCESS',
            shopId: selectedShop ? selectedShop.id : 1
          };

          await fetch(`${API_BASE_URL}/api/payments/process`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(debitPayload),
          });

          setWalletBalance(prev => prev - totalAmount);
          setPaymentHistory(prev => [{
            id: debitPayload.transactionId,
            type: 'DEBIT',
            method: `Paid for Order (${savedOrder.shopName || 'Store'})`,
            amount: totalAmount,
            date: 'Just now',
            status: 'Success'
          }, ...prev]);
        } 
        else if (methodName.includes('Razorpay')) {
          const rzpPayload = {
            transactionId: "ORD_RAZOR_" + Math.floor(100000 + Math.random() * 900000),
            customerMobile: address.mobile,
            totalAmount: totalAmount,
            paymentMethod: 'Razorpay Online Checkout',
            paymentStatus: 'SUCCESS',
            shopId: selectedShop ? selectedShop.id : 1
          };

          await fetch(`${API_BASE_URL}/api/payments/process`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rzpPayload),
          });

          setPaymentHistory(prev => [{
            id: rzpPayload.transactionId,
            type: 'DEBIT',
            method: 'Razorpay Online Checkout',
            amount: totalAmount,
            date: 'Just now',
            status: 'Success'
          }, ...prev]);
        }

        const formattedOrder = {
          id: savedOrder.orderId || savedOrder.id || '#ORD-' + Math.floor(1000 + Math.random() * 9000),
          type: selectedCategory || 'Food',
          shop: savedOrder.shopName || (selectedShop ? selectedShop.name : 'Store'),
          items: savedOrder.items || newOrderPayload.items,
          qtotal: savedOrder.totalAmount || totalAmount,
          date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) + ' - ' + new Date().toLocaleDateString(),
          customerName: address.name,
          mobile: address.mobile || phone,
          deliveryAddress: newOrderPayload.deliveryAddress,
          paymentMethod: methodName,
          status: savedOrder.status || 'Pending Approval',
          deliveryOtp: savedOrder.deliveryOtp || savedOrder.delivery_otp || null,
          rating: null
        };

        setBackendOrders(prev => [formattedOrder, ...prev]);
        setSuccessReceipt(formattedOrder);
        setIsPaymentScreen(false);
        setSelectedCategory(null);
        setSelectedShop(null);
        setCart([]);
        setDiscount(0);
        setPromoCode('');
        setRiderTip(0);
        
        triggerScratchCard(totalAmount);

        toast.success('🎉 Order Placed & Saved to History Successfully!');
      } else {
        toast.error('❌ Failed to place order in backend server.');
      }
    } catch (error) {
      console.error("Order error:", error);
      toast.error('❌ Server connection error.');
    }
  };

  const handlePayment = async (method) => {
    if (method.includes('Wallet') && walletBalance < totalAmount) {
      toast.error('❌ Insufficient Wallet Balance! Please add money.');
      return;
    }

    if (method.includes('Razorpay')) {
      const options = {
        key: "rzp_test_TTbofIebO8RB99",
        amount: totalAmount * 100,
        currency: "INR",
        name: "Foodiee Delivery App",
        description: `Order Payment for Store`,
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Foodiee",
        handler: async function (response) {
          await processOrderCompletion('Razorpay Online');
        },
        prefill: {
          name: address.name,
          email: "user@foodiee.com",
          contact: address.mobile
        },
        theme: {
          color: "#fc8019"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
      return;
    }

    await processOrderCompletion(method);
  };

  const submitRating = (orderId) => {
    setBackendOrders(backendOrders.map(o => (o.id === orderId || o.orderId === orderId) ? { ...o, rating: stars } : o));
    setRatingModal(null);
    toast.success('⭐ Thank you for your feedback!');
  };

  const toggleFavorite = (shop) => {
    if (favorites.some(f => f.id === shop.id)) {
      setFavorites(favorites.filter(f => f.id !== shop.id));
      toast.success(`Removed ${shop.name} from Favorites`);
    } else {
      setFavorites([...favorites, shop]);
      toast.success(`Added ${shop.name} to Favorites ❤️`);
    }
  };

  const dynamicShops = allShops
    .filter(shop => {
      const shopCat = (shop.category || '').toUpperCase();
      const targetCat = (selectedCategory || '').toUpperCase();
      if (!targetCat) return true;
      if (targetCat === 'MEAT & FISH') {
        return shopCat.includes('MEAT') || shopCat.includes('CHICKEN') || shopCat.includes('MUTTON') || shopCat.includes('FISH') || shopCat.includes('MEAT & FISH');
      }
      return shopCat.includes(targetCat);
    })
    .filter(shop => {
      if (quickFilter === 'Trending') return (shop.rating || 4.8) >= 4.8;
      if (quickFilter === 'Fast Delivery') return true;
      if (quickFilter === 'Top Rated') return (shop.rating || 4.8) >= 4.7;
      return true;
    })
    .map(shop => {
      const shopItems = backendFoodItems.filter(item =>
        item.restaurantId === shop.id || item.restaurantId === Number(shop.id) || item.shopId === shop.id || item.shopId === Number(shop.id)
      );

      const categoriesMap = {};
      shopItems.forEach(item => {
        const cat = item.category || 'General';
        if (!categoriesMap[cat]) categoriesMap[cat] = [];
        categoriesMap[cat].push(item);
      });

      return {
        id: shop.id,
        name: shop.shopName || shop.name || 'Local Store', 
        imageUrl: (shop.imageUrl && shop.imageUrl.trim() !== '') ? shop.imageUrl : 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
        additionalImages: shop.additionalImages || [],
        rating: shop.rating ? `${shop.rating} ⭐` : '4.8 ⭐',
        time: shop.deliveryTime || '15 mins',
        category: shop.category || 'Food & Tiffins',
        address: shop.address || 'Main Road, Ichapuram',
        categories: categoriesMap,
        items: shopItems
      };
    });

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-0 sm:p-4 font-sans">
      <div className="w-full max-w-[420px] h-[100dvh] sm:h-[840px] bg-slate-900 sm:rounded-[3rem] sm:shadow-2xl sm:border-[8px] sm:border-slate-800 flex flex-col relative overflow-hidden text-gray-900 dark:text-white"> <Toaster />

        {/* --- DYNAMIC PROMO POP-UP MODAL --- */}
        {promoPopup && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/60 w-full max-w-xs rounded-[36px] p-6 text-white text-center space-y-4 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#fc8019]/20 rounded-full blur-2xl"></div>
              
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-[#fc8019] to-amber-400 text-slate-950 flex items-center justify-center text-2xl font-black shadow-lg">
                🎁
              </div>

              <div className="space-y-1">
                <span className="bg-amber-500/20 text-amber-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">Special Offer</span>
                <h3 className="text-lg font-black text-white mt-1">New Coupon Unlocked!</h3>
                <p className="text-xs text-slate-300 font-bold bg-slate-800 p-2 rounded-xl border border-slate-700">
                  Code: <span className="text-amber-400">{promoPopup.code}</span> ({promoPopup.discount})
                </p>
              </div>

              <p className="text-[11px] text-slate-400">This offer has been automatically saved to your Notifications and Checkout panel.</p>

              <button 
                onClick={() => {
                  setPromoCode(promoPopup.code);
                  setPromoPopup(null);
                  toast.success(`✓ Code ${promoPopup.code} applied!`);
                }} 
                className="w-full bg-[#fc8019] hover:bg-amber-400 text-slate-950 py-3.5 rounded-2xl font-black text-xs shadow-lg cursor-pointer transition"
              >
                Apply Code Now 🚀
              </button>

              <button 
                onClick={() => setPromoPopup(null)} 
                className="text-[11px] text-slate-400 hover:text-white font-bold underline cursor-pointer"
              >
                Later
              </button>
            </div>
          </div>
        )}

        {/* WALLET HISTORY POPUP MODAL */}
        {isWalletHistoryOpen && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-slate-900 border border-amber-500/50 w-full max-w-sm rounded-[32px] p-5 text-white space-y-4 shadow-2xl overflow-y-auto max-h-[85vh]">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📜</span>
                  <h3 className="text-sm font-black text-amber-400">Complete Wallet History</h3>
                </div>
                <button onClick={() => setIsWalletHistoryOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <XCircle size={22} />
                </button>
              </div>

              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {paymentHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-10">No transactions found.</p>
                ) : (
                  paymentHistory.map((pay, i) => (
                    <div key={i} className="bg-slate-800/80 border border-slate-700/70 p-3.5 rounded-2xl flex justify-between items-center text-xs">
                      <div className="space-y-0.5">
                        <p className="font-black text-white">{pay.method}</p>
                        <p className="text-[10px] text-slate-400">{pay.date} • ID: {pay.id}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-sm ${pay.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pay.type === 'CREDIT' ? `+₹${pay.amount}` : `-₹${pay.amount}`}
                        </p>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${pay.type === 'CREDIT' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {pay.status || 'Success'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button 
                onClick={() => setIsWalletHistoryOpen(false)} 
                className="w-full bg-[#fc8019] hover:bg-[#e07015] text-slate-950 py-3 rounded-2xl font-black text-xs shadow-lg cursor-pointer transition"
              >
                Close History
              </button>
            </div>
          </div>
        )}

        {/* EDIT PROFILE MODAL */}
        {isEditProfileModalOpen && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-slate-900 border border-amber-500/50 w-full max-w-sm rounded-[32px] p-6 text-white space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-amber-400">Edit Name & Address</h3>
                <button onClick={() => setIsEditProfileModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <XCircle size={22} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Customer Name</label>
                  <input 
                    type="text" 
                    value={editProfileName} 
                    onChange={async (e) => {
                      const newName = e.target.value;
                      setEditProfileName(newName);
                      setAddress(prev => ({ ...prev, name: newName }));
                      try {
                        await fetch(`${API_BASE_URL}/api/user/update-profile`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ mobile: address.mobile || phone, name: newName })
                        });
                      } catch (err) {
                        console.error("Failed to sync profile name update with backend", err);
                      }
                    }} 
                    className="w-full bg-slate-800 border border-slate-700 p-3 rounded-2xl text-xs font-bold text-white outline-none" 
                    placeholder="Enter your name" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Street / Area Address</label>
                  <input 
                    type="text" 
                    value={address.street || ''} 
                    onChange={(e) => setAddress({...address, street: e.target.value})} 
                    className="w-full bg-slate-800 border border-slate-700 p-3 rounded-2xl text-xs font-bold text-white outline-none" 
                    placeholder="Enter street/area" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">Landmark</label>
                  <input 
                    type="text" 
                    value={address.landmark || ''} 
                    onChange={(e) => setAddress({...address, landmark: e.target.value})} 
                    className="w-full bg-slate-800 border border-slate-700 p-3 rounded-2xl text-xs font-bold text-white outline-none" 
                    placeholder="Enter landmark" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">District</label>
                  <input 
                    type="text" 
                    value={address.district || ''} 
                    onChange={(e) => setAddress({...address, district: e.target.value})} 
                    className="w-full bg-slate-800 border border-slate-700 p-3 rounded-2xl text-xs font-bold text-white outline-none" 
                    placeholder="Enter district" 
                  />
                </div>
              </div>

              <button 
                onClick={async () => {
                  setAddress(prev => ({ ...prev, name: editProfileName }));
                  try {
                    await fetch(`${API_BASE_URL}/api/user/update-profile`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ mobile: address.mobile || phone, name: editProfileName })
                    });
                  } catch (err) {
                    console.error("Failed to sync profile update with database", err);
                  }
                  setIsEditProfileModalOpen(false);
                  toast.success('✓ Profile name & address updated successfully!');
                }} 
                className="w-full bg-[#fc8019] hover:bg-[#e07015] text-slate-950 py-3.5 rounded-2xl font-black text-xs shadow-lg cursor-pointer transition mt-2"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* SCRATCH CARD HUMAN-TOUCH MODAL */}
        {activeScratchCard && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/60 w-full max-w-xs rounded-[36px] p-6 text-white text-center space-y-4 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/25 rounded-full blur-2xl"></div>
              
              <div className="space-y-1">
                <span className="bg-amber-500/20 text-amber-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">* Scratch Card Hub</span>
                <h3 className="text-lg font-black text-white mt-1">Scratch to Reveal! 🎁</h3>
                <p className="text-[11px] text-slate-400">Use your finger or mouse to scratch the card below</p>
              </div>

              <div className="relative w-64 h-36 mx-auto rounded-3xl overflow-hidden border-2 border-amber-500/50 bg-slate-950 flex items-center justify-center shadow-inner">
                {/* Revealed Amount */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-emerald-900 to-slate-950">
                  <span className="text-[10px] uppercase font-bold text-emerald-300">Reward Unlocked</span>
                  <span className="text-4xl font-black text-emerald-400">₹{activeScratchCard.amount}</span>
                  <span className="text-[9px] text-slate-400 mt-0.5">Added instantly to wallet</span>
                </div>

                {/* Scratch Cover Canvas */}
                {scratchProgress < 60 && !activeScratchCard.isScratched ? (
                  <canvas
                    ref={canvasRef}
                    width={256}
                    height={144}
                    onMouseDown={startScratch}
                    onMouseUp={stopScratch}
                    onMouseMove={scratch}
                    onTouchStart={startScratch}
                    onTouchEnd={stopScratch}
                    onTouchMove={scratch}
                    className="absolute inset-0 cursor-crosshair touch-none rounded-3xl"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #fc8019, #b45309)' }}
                  />
                ) : null}
              </div>

              <div className="space-y-2 pt-1">
                <button 
                  onClick={claimScratchReward}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-2xl font-black text-xs shadow-lg cursor-pointer transition"
                >
                  Claim & Add to Wallet 💰
                </button>
                <button 
                  onClick={() => {
                    setActiveScratchCard(null);
                    setScratchProgress(0);
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-2xl font-bold text-xs cursor-pointer transition"
                >
                  * Save for Later (Close)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LOGIN / OTP VIEW */}
        {!isLoggedIn ? (
          <div className="flex flex-col flex-1 w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-[#fc8019]/30 items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-10 right-[-20px] w-56 h-56 bg-orange-500/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-10 left-[-20px] w-56 h-56 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-[370px] bg-slate-900/70 backdrop-blur-2xl rounded-[40px] p-8 shadow-2xl border border-white/10 space-y-6 relative z-10">
              <div className="text-center space-y-3">
                <div className="w-20 h-20 mx-auto rounded-3xl p-1 bg-gradient-to-tr from-[#fc8019] to-amber-400 shadow-xl shadow-orange-500/30 flex items-center justify-center transform hover:scale-105 transition-transform duration-300">
                  <div className="w-full h-full bg-slate-950 rounded-[22px] overflow-hidden flex items-center justify-center">
                    <img src="/src/assets/logo.png" alt="Foodiee Logo" className="w-full h-full object-cover" />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-amber-400 bg-clip-text text-transparent">
                    Foodiee..
                  </h2>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                    Ichapuram's Fast Delivery Ecosystem
                  </p>
                </div>
              </div>

              {step === 1 ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest pl-1">
                      Mobile Number
                    </label>
                    <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-700/80 px-4 py-4 rounded-2xl focus-within:border-[#fc8019] focus-within:ring-2 focus-within:ring-orange-500/20 transition-all duration-300 shadow-inner">
                      <div className="w-7 h-7 rounded-xl bg-orange-500/20 text-[#fc8019] flex items-center justify-center shrink-0">
                        <Phone size={14} />
                      </div>
                      <input 
                        type="tel" 
                        maxLength="10" 
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)} 
                        placeholder="Enter 10-digit mobile number" 
                        className="bg-transparent border-none outline-none text-xs w-full font-bold text-white placeholder:text-slate-500" 
                        required 
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-[#fc8019] via-amber-500 to-yellow-400 text-slate-950 py-4 rounded-2xl font-black text-xs shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                  >
                    <span>Send Verification OTP</span>
                    <ArrowRight size={16} />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fadeIn">
                  <div className="text-center space-y-1.5 bg-slate-950/40 p-3 rounded-2xl border border-slate-800">
                    <p className="text-[11px] text-slate-300 font-bold">OTP sent securely to</p>
                    <p className="text-sm font-black text-[#fc8019] flex items-center justify-center gap-2">
                      <span>+91 {phone}</span>
                      <span onClick={() => setStep(1)} className="text-[10px] text-blue-400 underline cursor-pointer hover:text-blue-300">Change</span>
                    </p>
                    {generatedOtpHint && (
                      <div className="inline-block bg-amber-500/20 border border-amber-500/50 px-3 py-1 rounded-xl mt-1">
                        <p className="text-[10px] text-amber-300 font-bold">Hint OTP: <span className="text-white font-black">{generatedOtpHint}</span></p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest text-center">
                      Enter 4-Digit OTP
                    </label>
                    <div className="flex items-center justify-center bg-slate-950/60 border border-slate-700/80 px-4 py-3.5 rounded-2xl shadow-inner">
                      <input 
                        type="text" 
                        maxLength="4" 
                        value={otpInput} 
                        onChange={(e) => setOtpInput(e.target.value)} 
                        placeholder="----" 
                        className="bg-transparent border-none outline-none text-xl w-full font-black text-white tracking-[0.5em] text-center placeholder:tracking-normal" 
                        required 
                        autoFocus
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white py-4 rounded-2xl font-black text-xs shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                  >
                    <span>Verify & Login Now</span>
                    <CheckCircle2 size={16} />
                  </button>
                </form>
              )}

              <div className="text-center pt-2">
                <p className="text-[10px] text-slate-500 font-medium">
                  By continuing, you agree to Foodiee's Terms & Privacy Policy
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className={`flex flex-col flex-1 w-full h-full font-sans relative overflow-hidden transition-colors duration-500 ${
            darkMode ? 'bg-slate-900 text-white' : 'bg-gradient-to-br from-slate-50 via-gray-100 to-orange-50/40 text-gray-900'
          }`}>

            {/* HEADER */}
            <header className={`${darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-b'} backdrop-blur-md border-b px-3 py-2.5 shrink-0 shadow-sm z-30 space-y-1.5`}>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setActiveTab('home'); setSelectedCategory(null); setSelectedShop(null); setIsPaymentScreen(false); setActiveTrackingOrder(null); }}
                  className="flex items-center gap-2 text-left cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-2xl overflow-hidden shadow-lg border-2 border-[#fc8019] flex items-center justify-center transform group-hover:scale-105 transition-transform">
                    <img src="/src/assets/logo.png" alt="Foodiee Logo" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h1 className="text-base font-black tracking-wider bg-gradient-to-r from-[#fc8019] via-amber-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-sm">
                      Foodiee
                    </h1>
                    <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-400 tracking-wide mt-[-2px]">
                      Ichapuram
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setShowNotificationModal(true)} className="relative p-1.5 rounded-xl bg-orange-50 dark:bg-slate-700 text-[#fc8019]" title="Offers">
                    <Bell size={16} />
                    {notifications.some(n => n.unread) && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
                    )}
                  </button>

                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className={`px-2 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 border shadow-sm transition ${darkMode ? 'bg-amber-500 text-slate-900 border-amber-400' : 'bg-slate-900 text-amber-400 border-slate-800'}`}
                  >
                    {darkMode ? <Sun size={13} /> : <Moon size={13} />}
                    <span>{darkMode ? 'Day' : 'Night'}</span>
                  </button>

                  <button onClick={() => setActiveTab('wallet')} className="bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full text-[10px] font-black text-[#fc8019] flex items-center gap-1 shadow-sm">
                    <Wallet size={11} /> ₹{walletBalance.toFixed(2)}
                  </button>
                  <button onClick={() => setIsDrawerOpen(true)} className="p-1.5 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200">
                    <Menu size={16} />
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className={`flex items-center px-3 py-2 rounded-2xl gap-2 border ${darkMode ? 'bg-slate-700/80 border-slate-600 text-white' : 'bg-gray-100 border-gray-200 text-gray-800'} focus-within:border-[#fc8019]`}>
                  <Search size={13} className="text-gray-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search dishes, groceries or address..."
                    className="bg-transparent text-xs w-full outline-none font-bold placeholder:text-gray-400"
                  />
                  <button onClick={() => toast.success('🎤 Voice search listening...')} className="text-gray-400 hover:text-[#fc8019]">
                    <Mic size={14} />
                  </button>
                </div>
              </div>
            </header>

            {/* NOTIFICATIONS MODAL */}
            {showNotificationModal && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className={`${darkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'} w-full max-w-xs p-5 rounded-3xl shadow-2xl space-y-4 text-xs`}>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-black text-sm flex items-center gap-1.5"><Bell size={15} className="text-[#fc8019]" /> Notifications</span>
                    <button onClick={() => { setShowNotificationModal(false); setNotifications(notifications.map(n => ({ ...n, unread: false }))); }} className="font-bold text-gray-400">✕</button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {notifications.map((notif) => (
                      <div key={notif.id} className={`p-3 rounded-2xl border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-orange-50/50 border-orange-100'} space-y-1`}>
                        <div className="flex justify-between font-bold text-[#fc8019]">
                          <span>{notif.title}</span>
                          <span className="text-[9px] text-gray-400">{notif.time}</span>
                        </div>
                        <p className="text-[11px] text-gray-600 dark:text-gray-300">{notif.desc}</p>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => { setShowNotificationModal(false); setNotifications(notifications.map(n => ({ ...n, unread: false }))); }} className="w-full bg-[#fc8019] text-white py-2.5 rounded-xl font-black">
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* SIDE DRAWER */}
            {isDrawerOpen && (
              <div className="absolute inset-0 z-50 flex justify-end">
                <div className={`${darkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'} w-64 h-full shadow-2xl p-4 flex flex-col justify-between space-y-4 animate-fadeIn`}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-700 pb-3">
                      <div className="flex items-center gap-2">
                        <img src={userPhoto} alt="Profile" className="w-9 h-9 rounded-full border border-[#fc8019] object-cover" />
                        <div>
                          <h3 className="text-xs font-black">{address.name}</h3>
                          <p className="text-[10px] text-gray-400">{address.mobile}</p>
                        </div>
                      </div>
                      <button onClick={() => setIsDrawerOpen(false)} className="text-xs font-bold text-gray-400">✕</button>
                    </div>

                    <div className="space-y-1 text-xs font-bold">
                      <label className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer">
                        <Camera size={15} className="text-[#fc8019]" />
                        <span>Upload photo to DB</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                      </label>
                      <button onClick={() => { setActiveTab('wallet'); setIsDrawerOpen(false); }} className="w-full text-left p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2">
                        <Wallet size={15} className="text-[#fc8019]" /> My Wallet (₹{walletBalance.toFixed(2)})
                      </button>
                      <button onClick={() => { setActiveTab('favorites'); setIsDrawerOpen(false); }} className="w-full text-left p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2">
                        <Heart size={15} className="text-[#fc8019]" /> Favorites
                      </button>
                      <button onClick={() => { setActiveTab('history'); setIsDrawerOpen(false); }} className="w-full text-left p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2">
                        <Clock size={15} className="text-[#fc8019]" /> Order History
                      </button>
                      <button onClick={() => { setActiveTab('offers'); setIsDrawerOpen(false); }} className="w-full text-left p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2">
                        <Gift size={15} className="text-[#fc8019]" /> Offers & Rewards (* Scratch Cards)
                      </button>
                      <button onClick={() => { setActiveTab('address'); setIsDrawerOpen(false); }} className="w-full text-left p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2">
                        <MapPin size={15} className="text-[#fc8019]" /> Saved Address
                      </button>
                      <button onClick={() => { setIsSupportChatOpen(true); setIsDrawerOpen(false); }} className="w-full text-left p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2">
                        <MessageCircle size={15} className="text-[#fc8019]" /> Live Support Chat
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={() => { 
                      localStorage.removeItem('userMobile'); 
                      localStorage.removeItem('userName'); 
                      setIsLoggedIn(false); 
                      setStep(1); 
                      setOtpInput(''); 
                    }} 
                    className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 py-4 rounded-2xl font-black text-xs shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <LogOut size={16} /> Logout from Foodiee
                  </button>
                </div>
                <div className="flex-1 bg-black/40" onClick={() => setIsDrawerOpen(false)}></div>
              </div>
            )}

            {/* RATING MODAL */}
            {ratingModal && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className={`${darkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'} w-full max-w-xs p-4 rounded-3xl shadow-2xl space-y-3 text-xs`}>
                  <h3 className="font-black text-center text-sm">Rate Order</h3>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button key={s} onClick={() => setStars(s)} className={`text-xl ${s <= stars ? 'text-amber-400' : 'text-gray-300'}`}>★</button>
                    ))}
                  </div>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Write a review..."
                    className={`w-full border p-2 rounded-xl outline-none text-xs ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-gray-50 border-gray-200'}`}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setRatingModal(null)} className="flex-1 bg-gray-200 dark:bg-slate-700 py-2 rounded-xl font-bold">Cancel</button>
                    <button onClick={() => submitRating(ratingModal)} className="flex-1 bg-[#fc8019] text-white py-2 rounded-xl font-bold">Submit</button>
                  </div>
                </div>
              </div>
            )}

            {/* ADD MONEY MODAL */}
            {isAddMoneyModalOpen && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 border border-amber-500/50 w-full max-w-sm rounded-3xl p-6 text-white space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black text-amber-400">Add Money to Wallet</h3>
                    <button onClick={() => setIsAddMoneyModalOpen(false)} className="text-slate-400"><XCircle size={20} /></button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Enter Custom Amount (₹)</label>
                    <input 
                      type="number" 
                      value={addAmountInput} 
                      onChange={(e) => setAddAmountInput(e.target.value)} 
                      placeholder="Enter amount (e.g. 100)" 
                      className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl text-sm font-black text-white outline-none" 
                    />
                  </div>

                  <button 
                    onClick={handleRazorpayPayment} 
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3.5 rounded-2xl font-black text-xs shadow-lg flex items-center justify-center gap-2"
                  >
                    <span>💳 Pay Securely with Razorpay</span>
                  </button>

                  <div className="space-y-2 pt-1 border-t border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Or Pay Directly via Apps</p>
                    <button onClick={() => handleUpiPayment('PhonePe', 'phonepe')} className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-xl font-black text-xs shadow flex items-center justify-center gap-2">💜 Pay with PhonePe</button>
                    <button onClick={() => handleUpiPayment('Google Pay', 'gpay')} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-black text-xs shadow flex items-center justify-center gap-2">💙 Pay with Google Pay (GPay)</button>
                    <button onClick={() => handleUpiPayment('Paytm', 'paytm')} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-2.5 rounded-xl font-black text-xs shadow flex items-center justify-center gap-2">🤍 Pay with Paytm</button>
                  </div>
                </div>
              </div>
            )}

            {/* SUPPORT CHAT MODAL */}
            {isSupportChatOpen && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-sm h-[500px] rounded-[32px] overflow-hidden flex flex-col shadow-2xl relative">
                  <div className="bg-[#fc8019] p-4 text-slate-950 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💬</span>
                      <h3 className="font-black text-xs uppercase">Foodiee Customer Support</h3>
                    </div>
                    <button onClick={() => setIsSupportChatOpen(false)} className="text-slate-950 font-black cursor-pointer">✕</button>
                  </div>

                  <div className="flex-1 overflow-hidden bg-slate-950">
                    <CustomerSupportChat userMobile={phone || localStorage.getItem('userMobile')} />
                  </div>
                </div>
              </div>
            )}

            {/* FLOATING SUPPORT CHAT BUTTON WITH UNREAD COUNT & BLINKING DOT[cite: 2] */}
            <div className="absolute bottom-20 right-4 z-40">
              <button 
                onClick={() => {
                  setIsSupportChatOpen(true);
                  setUnreadSupportCount(0); 
                }}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3.5 rounded-full shadow-2xl flex items-center justify-center cursor-pointer hover:scale-110 transition-transform relative"
                title="Chat with Support"
              >
                <MessageCircle size={20} />

                {unreadSupportCount > 0 && (
                  <>
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg">
                      {unreadSupportCount}
                    </span>
                    <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-yellow-400 border-2 border-slate-900 rounded-full animate-ping"></span>
                  </>
                )}
              </button>
            </div>

            {/* --- REAL-TIME ORDER CHAT MODAL --- */}
            {activeChatRecipient && activeTrackingOrder && (
              <OrderChatModal 
                orderId={activeTrackingOrder.orderId || activeTrackingOrder.id} 
                userMobile={address.mobile || phone || localStorage.getItem('userMobile')} 
                userRole="customer" 
                recipientRole={activeChatRecipient} 
                orderStatus={activeTrackingOrder.status}
                onClose={() => setActiveChatRecipient(null)} 
              />
            )}

            {/* MAIN CONTENT */}
            <main className={`flex-1 overflow-y-auto p-4 space-y-4 pb-28 transition-colors duration-500 ${
              selectedCategory === 'Food' ? (darkMode ? 'bg-amber-950/30' : 'bg-amber-50/80') :
              selectedCategory === 'Grocery' ? (darkMode ? 'bg-emerald-950/30' : 'bg-emerald-50/80') :
              selectedCategory === 'Meat & Fish' ? (darkMode ? 'bg-rose-950/30' : 'bg-rose-50/80') : ''
            }`}>

              {successReceipt && (
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-xs space-y-0.5 text-gray-900">
                  <p className="font-bold text-emerald-800 flex items-center gap-1"><CheckCircle2 size={13} /> Order Placed Successfully!</p>
                  <p className="text-[11px]">ID: {successReceipt.id}</p>
                </div>
              )}

              {/* LIVE TRACKING VIEW */}
              {activeTrackingOrder ? (
                (() => {
                  const shopLat = activeTrackingOrder.shopLat || activeTrackingOrder.shop_lat || 18.5793;
                  const shopLng = activeTrackingOrder.shopLng || activeTrackingOrder.shop_lng || 84.4452;
                  const customerLat = activeTrackingOrder.customerLat || activeTrackingOrder.customer_lat || address.latitude || 18.5850;
                  const customerLng = activeTrackingOrder.customerLng || activeTrackingOrder.customer_lng || address.longitude || 84.4520;

                  return (
                    <div className="space-y-3 pb-6 animate-fadeIn">
                      <button onClick={() => setActiveTrackingOrder(null)} className="text-xs font-bold text-gray-400 flex items-center gap-1 hover:text-white transition">
                        <ArrowLeft size={14} /> Back to Dashboard
                      </button>

                      <div className="bg-slate-900 border border-amber-500/30 backdrop-blur-md text-white rounded-[32px] overflow-hidden shadow-2xl space-y-4">
                        <div className="p-4 pb-2 flex justify-between items-center border-b border-slate-800">
                          <div>
                            <span className="bg-[#fc8019]/20 text-[#fc8019] text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">Live Tracking</span>
                            <h3 className="text-sm font-black mt-1 text-white">Order from {activeTrackingOrder.shopName || activeTrackingOrder.shop}</h3>
                            <p className="text-[10px] text-slate-400">Order ID: {activeTrackingOrder.orderId || activeTrackingOrder.id}</p>
                          </div>
                        </div>

                        <div className="w-full h-56 relative border-y border-slate-800">
                          <MapContainer center={[riderLocation.lat, riderLocation.lng]} zoom={15} zoomControl={false} className="w-full h-full z-10">
                            <MapUpdater center={[riderLocation.lat, riderLocation.lng]} />
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            
                            <Polyline 
                              positions={[[riderLocation.lat, riderLocation.lng], [shopLat, shopLng]]} 
                              color="#fc8019" 
                              weight={4} 
                              dashArray="5, 5" 
                            />

                            <Polyline 
                              positions={[[shopLat, shopLng], [customerLat, customerLng]]} 
                              color="#3b82f6" 
                              weight={5} 
                            />

                            <Marker 
                              position={[riderLocation.lat, riderLocation.lng]} 
                              icon={getAnimatedBikeIcon(0)} 
                            />
                          </MapContainer>
                          
                          <div className="absolute top-4 right-4 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl text-center border border-emerald-400/40 backdrop-blur-md animate-pulse z-20">
                            <p className="text-lg font-black leading-none">12</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider opacity-90 mt-0.5">Mins</p>
                          </div>

                          <div className="absolute top-4 left-4 bg-slate-950/90 backdrop-blur-md border border-amber-500/30 px-3 py-2 rounded-2xl shadow-xl flex items-center gap-2 z-20">
                            <span className="text-base animate-bounce">🛵</span>
                            <div>
                              <p className="text-[11px] font-black text-white">Rider is on the way</p>
                              <p className="text-[9px] text-emerald-400 font-bold">{activeTrackingOrder.status || 'Out for delivery 🛵'}</p>
                            </div>
                          </div>
                        </div>

                        <div className="px-4 space-y-3">
                          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-emerald-500/30 space-y-1">
                            <h4 className="text-xs font-black text-white uppercase tracking-wider">Current Status</h4>
                            <span className="inline-block bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[11px] font-bold animate-pulse">
                              ● {activeTrackingOrder.status || 'Out for delivery 🛵'}
                            </span>
                          </div>

                          {((activeTrackingOrder.status || '').toLowerCase().includes('out for delivery') || activeTrackingOrder.deliveryOtp || activeTrackingOrder.delivery_otp) && (
                            <div className="bg-amber-500/20 border-2 border-amber-500 px-3 py-2.5 rounded-2xl text-center">
                              <p className="text-[10px] text-amber-300 font-black uppercase tracking-wider">Delivery OTP for Partner</p>
                              <h3 className="text-xl font-black text-amber-400 tracking-[0.2em] mt-0.5">
                                {activeTrackingOrder.deliveryOtp || activeTrackingOrder.delivery_otp || '----'}
                              </h3>
                            </div>
                          )}

                          {/* --- CHAT BUTTONS FOR CUSTOMER --- */}
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => { setActiveChatRecipient('partner'); setUnreadOrderCount(0); }} 
                              className="bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow relative"
                            >
                              <Bike size={14} /> Chat with Delivery
                              {unreadOrderCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-600 text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                                  {unreadOrderCount}
                                </span>
                              )}
                            </button>

                            <button 
                              onClick={() => { setActiveChatRecipient('shop'); setUnreadOrderCount(0); }} 
                              className="bg-[#fc8019] hover:bg-[#e07015] text-slate-950 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow relative"
                            >
                              <Store size={14} /> Chat with Shop
                            </button>
                          </div>

                          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-base font-black text-amber-400">
                                <Store size={18} />
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-white">{activeTrackingOrder.shopName || activeTrackingOrder.shop}</h4>
                                <p className="text-[9px] text-slate-400">Shop Owner</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => toast.success(`📞 Calling shop...`)} className="w-9 h-9 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center shadow"><Phone size={15} /></button>
                            </div>
                          </div>

                          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-base font-black text-amber-400">👨‍✈️</div>
                              <div>
                                <h4 className="text-xs font-black text-white">Bommali Naveen</h4>
                                <p className="text-[9px] text-slate-400">Delivery Partner (AP 30 BIKE 1234)</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => toast.success(`📞 Calling delivery partner...`)} className="w-9 h-9 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center shadow"><Phone size={15} /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : isPaymentScreen ? (
                <div className="space-y-3">
                  <button onClick={() => setIsPaymentScreen(false)} className="text-xs font-bold text-gray-500 flex items-center gap-1">
                    <ArrowLeft size={13} /> Back
                  </button>

                  <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} p-3 rounded-2xl border shadow-sm space-y-2`}>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-extrabold text-gray-400 uppercase flex items-center gap-1"><MapPin size={12} className="text-[#fc8019]" /> Delivery Address (GPS Synced)</span>
                      <button onClick={() => { setIsEditingAddress(!isEditingAddress); setEditableAddress(address); }} className="text-[10px] text-[#fc8019] font-black underline cursor-pointer">
                        {isEditingAddress ? 'Close' : 'Edit / GPS 📍'}
                      </button>
                    </div>

                    {!isEditingAddress ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold">{address.name} ({address.mobile})</p>
                        <p className="text-[11px] text-gray-400">
                          {address.houseNo ? `${address.houseNo}, ` : ''}{address.street}, {address.landmark ? `Near ${address.landmark}, ` : ''}{address.district}, {address.state} - {address.pincode}
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handleSaveEditedAddress} className="space-y-2 pt-1 border-t border-slate-700 text-xs">
                        <div className="flex gap-2">
                          <button type="button" onClick={detectLiveGpsLocation} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 shadow cursor-pointer">
                            <Navigation size={12} /> Detect Live GPS Coordinates
                          </button>
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 font-bold uppercase">Customer Name</label>
                          <input type="text" value={editableAddress.name || ''} onChange={(e) => setEditableAddress({...editableAddress, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-xl text-xs font-bold text-white outline-none mt-0.5" required />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 font-bold uppercase">Flat/House No</label>
                          <input type="text" value={editableAddress.houseNo || ''} onChange={(e) => setEditableAddress({...editableAddress, houseNo: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-xl text-xs font-bold text-white outline-none mt-0.5" />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 font-bold uppercase">Apartment / Area</label>
                          <input type="text" value={editableAddress.street} onChange={(e) => setEditableAddress({...editableAddress, street: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-xl text-xs font-bold text-white outline-none mt-0.5" required />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 font-bold uppercase">Landmark</label>
                          <input type="text" value={editableAddress.landmark || ''} onChange={(e) => setEditableAddress({...editableAddress, landmark: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-xl text-xs font-bold text-white outline-none mt-0.5" />
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[9px] text-slate-400 font-bold uppercase">District</label>
                            <input type="text" value={editableAddress.district} onChange={(e) => setEditableAddress({...editableAddress, district: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-xl text-xs font-bold text-white outline-none mt-0.5" required />
                          </div>
                          <div className="w-24">
                            <label className="text-[9px] text-slate-400 font-bold uppercase">Pincode</label>
                            <input type="text" value={editableAddress.pincode} onChange={(e) => setEditableAddress({...editableAddress, pincode: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-xl text-xs font-bold text-white outline-none mt-0.5" required />
                          </div>
                        </div>
                        <button type="submit" className="w-full bg-[#fc8019] text-slate-950 py-2 rounded-xl font-black text-xs shadow cursor-pointer">Save Address & Name</button>
                      </form>
                    )}
                  </div>

                  <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} p-3 rounded-2xl border shadow-sm space-y-2 text-xs`}>
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-gray-400 uppercase flex items-center gap-1"><Users size={13} /> Split Bill</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSplitPeople(Math.max(1, splitPeople - 1))} className="border px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-700 font-bold">-</button>
                        <span className="font-black">{splitPeople} People</span>
                        <button onClick={() => setSplitPeople(splitPeople + 1)} className="border px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-700 font-bold">+</button>
                      </div>
                    </div>
                    {splitPeople > 1 && (
                      <p className="text-emerald-600 font-bold text-[11px]">Each pays: ₹{splitAmount}</p>
                    )}
                  </div>

                  <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} p-3 rounded-2xl border shadow-sm space-y-2 text-xs`}>
                    <span className="font-extrabold text-gray-400 uppercase">Tip Rider 🛵</span>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 10, 20, 50].map((t) => (
                        <button key={t} onClick={() => setRiderTip(t)} className={`p-2 rounded-xl font-bold border ${riderTip === t ? 'bg-[#fc8019] text-white border-[#fc8019]' : 'bg-gray-50 dark:bg-slate-700 border-gray-200'}`}>
                          {t === 0 ? 'None' : `₹${t}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} p-3 rounded-2xl border shadow-sm space-y-2.5`}>
                    <span className="text-[9px] font-extrabold text-gray-400 uppercase">Items</span>
                    <div className="space-y-1.5 border-b border-gray-100 dark:border-slate-700 pb-2.5">
                      {cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span>{item.qty}x {item.name}</span>
                          <span className="font-bold">₹{item.price * item.qty}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1 text-xs text-gray-400">
                      <div className="flex justify-between">
                        <span>Total</span>
                        <span className="font-bold">₹{subtotal}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Delivery</span>
                        <span className="font-bold">₹{deliveryFee}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>Discount</span>
                          <span>-₹{discount}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-dashed flex justify-between items-center text-xs font-black">
                        <span>To Pay</span>
                        <span className="text-[#fc8019] text-sm">₹{totalAmount}</span>
                      </div>
                    </div>
                  </div>

                  {/* AVAILABLE PROMO CODES SECTION */}
                  <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} p-3 rounded-2xl border shadow-sm space-y-2 text-xs`}>
                    <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">Available Promo Codes</span>
                    
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {availablePromos.map((promo, idx) => (
                        <div key={idx} className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl flex justify-between items-center">
                          <div>
                            <span className="bg-amber-500/20 text-amber-400 font-black px-2 py-0.5 rounded text-[10px]">{promo.code}</span>
                            <p className="text-[10px] text-slate-300 mt-1">{promo.discount} (Min Order: ₹{promo.minOrder || promo.minAmount || 149})</p>
                          </div>
                          <button 
                            onClick={() => {
                              setPromoCode(promo.code);
                              toast.success(`🎁 Code ${promo.code} selected!`);
                            }} 
                            className="bg-[#fc8019] text-slate-950 px-3 py-1 rounded-lg font-black text-[10px] cursor-pointer hover:bg-amber-400 transition"
                          >
                            Apply
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="Enter promo code"
                        className={`border p-2 rounded-xl flex-1 font-bold outline-none uppercase text-xs ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-gray-50 border-gray-200'}`}
                      />
                      <button onClick={applyPromo} className="bg-slate-900 text-white px-3.5 rounded-xl font-bold cursor-pointer">Verify</button>
                    </div>
                  </div>

                  <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} p-3 rounded-2xl border shadow-sm space-y-2`}>
                    <span className="text-[9px] font-extrabold text-gray-400 uppercase">Payment Method</span>
                    {[
                      { name: `foodiee Wallet`, icon: '💰' },
                      { name: 'Razorpay Online', icon: '⚡' },
                      { name: 'COD', icon: '💵' }
                    ].map((method, idx) => (
                      <button key={idx} onClick={() => handlePayment(method.name)} className={`w-full border p-2.5 rounded-xl text-xs font-bold flex justify-between items-center ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
                        <span>{method.icon} {method.name}</span>
                        <ChevronRight size={13} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : activeTab === 'favorites' ? (
                <div className="space-y-2.5 text-xs">
                  <h3 className="font-black text-gray-400 uppercase">Favorite Shops</h3>
                  {favorites.length === 0 ? (
                    <div className="text-center py-10 space-y-2">
                      <Heart size={32} className="mx-auto text-gray-400" />
                      <p className="text-gray-400 font-bold">No favorites added yet.</p>
                    </div>
                  ) : (
                    favorites.map(shop => (
                      <div key={shop.id} onClick={() => { setSelectedCategory('Food'); setSelectedShop(shop); }} className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} p-3 rounded-2xl border shadow-sm flex justify-between items-center cursor-pointer`}>
                        <div>
                          <h4 className="text-xs font-black text-[#fc8019]">{shop.name}</h4>
                          <p className="text-[10px] text-gray-400">{shop.category}</p>
                        </div>
                        <ChevronRight size={15} />
                      </div>
                    ))
                  )}
                </div>
              ) : activeTab === 'address' ? (
                <div className="space-y-4 text-xs animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-gray-400 uppercase tracking-wider text-[11px]">Your Saved Addresses</h3>
                    <span className="text-[10px] text-amber-400 font-bold">Ichapuram Zone 📍</span>
                  </div>

                  <div className="space-y-2.5">
                    {savedAddresses.map((addr) => (
                      <div key={addr.id} className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-700/80 p-4 rounded-[24px] shadow-xl flex justify-between items-start relative overflow-hidden group hover:border-[#fc8019] transition-all">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full blur-xl group-hover:bg-orange-500/20 transition-all"></div>
                        <div className="space-y-1 relative z-10">
                          <span className="bg-[#fc8019]/20 text-[#fc8019] text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">{addr.type}</span>
                          <p className="font-black text-white mt-1 text-xs">{addr.name} • <span className="text-slate-400 font-medium">{addr.mobile}</span></p>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {addr.houseNo ? `${addr.houseNo}, ` : ''}{addr.street}, {addr.landmark ? `Near ${addr.landmark}, ` : ''}{addr.district}, {addr.state} - {addr.pincode}
                          </p>
                        </div>
                        <button onClick={() => { setAddress(addr); toast.success(`✓ Active delivery address set to ${addr.type}`); }} className="bg-slate-800 hover:bg-[#fc8019] text-white hover:text-slate-950 px-3 py-1.5 rounded-xl text-[10px] font-black transition cursor-pointer shadow-md relative z-10">Select</button>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-500/40 p-5 rounded-[32px] space-y-3.5 shadow-2xl relative overflow-hidden mt-4">
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl"></div>

                    <div className="flex justify-between items-center relative z-10 border-b border-slate-800 pb-3">
                      <h4 className="font-black text-amber-400 uppercase text-xs flex items-center gap-1.5">
                        <span>📍</span> Add Complete Address with GPS
                      </h4>
                      <button type="button" onClick={detectGpsForNewAddress} className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer transition transform hover:scale-105">
                        <Navigation size={12} className="animate-spin" /> Detect GPS 📌
                      </button>
                    </div>
                    
                    <div className="flex gap-2 relative z-10">
                      {['Home', 'Work', 'Friend', 'Other'].map(t => (
                        <button key={t} type="button" onClick={() => setNewAddressInput({...newAddressInput, type: t})} className={`flex-1 py-2 rounded-xl font-black text-[10px] transition cursor-pointer border ${newAddressInput.type === t ? 'bg-gradient-to-r from-[#fc8019] to-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-orange-500/20' : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'}`}>{t}</button>
                      ))}
                    </div>

                    <div className="space-y-3 relative z-10">
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Name</label>
                        <input type="text" value={newAddressInput.name} onChange={(e) => setNewAddressInput({...newAddressInput, name: e.target.value})} placeholder="Full Name" className="w-full bg-slate-800/90 border border-slate-700/80 p-3 rounded-2xl text-xs font-bold text-white outline-none focus:border-[#fc8019] transition" required />
                      </div>

                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Mobile Number</label>
                        <input type="text" value={newAddressInput.mobile} onChange={(e) => setNewAddressInput({...newAddressInput, mobile: e.target.value})} placeholder="Mobile Number" className="w-full bg-slate-800/90 border border-slate-700/80 p-3 rounded-2xl text-xs font-bold text-white outline-none focus:border-[#fc8019] transition" required />
                      </div>

                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Flat/House No</label>
                        <input type="text" value={newAddressInput.houseNo} onChange={(e) => setNewAddressInput({...newAddressInput, houseNo: e.target.value})} placeholder="ఇంటి నెంబర్ / ఫ్లోర్" className="w-full bg-slate-800/90 border border-slate-700/80 p-3 rounded-2xl text-xs font-bold text-white outline-none focus:border-[#fc8019] transition" />
                      </div>

                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Apartment / Area</label>
                        <input type="text" value={newAddressInput.street} onChange={(e) => setNewAddressInput({...newAddressInput, street: e.target.value})} placeholder="అపార్ట్‌మెంట్ / కాలనీ" className="w-full bg-slate-800/90 border border-slate-700/80 p-3 rounded-2xl text-xs font-bold text-white outline-none focus:border-[#fc8019] transition" required />
                      </div>

                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Landmark</label>
                        <input type="text" value={newAddressInput.landmark} onChange={(e) => setNewAddressInput({...newAddressInput, landmark: e.target.value})} placeholder="దగ్గర్లో ఉండే షాప్ లేదా గుడి" className="w-full bg-slate-800/90 border border-slate-700/80 p-3 rounded-2xl text-xs font-bold text-white outline-none focus:border-[#fc8019] transition" />
                      </div>

                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">District</label>
                        <input type="text" value={newAddressInput.district} onChange={(e) => setNewAddressInput({...newAddressInput, district: e.target.value})} placeholder="District" className="w-full bg-slate-800/90 border border-slate-700/80 p-3 rounded-2xl text-xs font-bold text-white outline-none focus:border-[#fc8019] transition" required />
                      </div>

                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">State</label>
                        <input type="text" value={newAddressInput.state} onChange={(e) => setNewAddressInput({...newAddressInput, state: e.target.value})} placeholder="State" className="w-full bg-slate-800/90 border border-slate-700/80 p-3 rounded-2xl text-xs font-bold text-white outline-none focus:border-[#fc8019] transition" required />
                      </div>

                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Pincode</label>
                        <input type="text" value={newAddressInput.pincode} onChange={(e) => setNewAddressInput({...newAddressInput, pincode: e.target.value})} placeholder="Pincode" className="w-full bg-slate-800/90 border border-slate-700/80 p-3 rounded-2xl text-xs font-bold text-white outline-none focus:border-[#fc8019] transition" required />
                      </div>
                    </div>

                    <button onClick={handleAddNewAddress} className="w-full bg-gradient-to-r from-[#fc8019] via-amber-500 to-yellow-500 hover:from-[#e07015] hover:to-amber-400 text-slate-950 py-3.5 rounded-2xl font-black text-xs shadow-xl shadow-orange-500/20 mt-3 cursor-pointer transition transform hover:scale-[1.01] relative z-10">
                      Save Complete Address 📍
                    </button>
                  </div>
                </div>
              ) : activeTab === 'offers' ? (
                <div className="space-y-4 text-xs animate-fadeIn pb-12">
                  <div className="flex justify-between items-center">
                    <h3 className="font-black text-gray-400 uppercase tracking-wider text-[11px]">* Offers & Rewards Hub</h3>
                    <span className="text-[10px] text-amber-400 font-bold">Scratch & Earn (&lt; ₹25)</span>
                  </div>

                  <div className="space-y-3">
                    {scratchCards.length === 0 ? (
                      <div className="text-center py-20 bg-slate-900 rounded-3xl border border-slate-800 space-y-2">
                        <span className="text-4xl">🎁</span>
                        <p className="text-xs text-slate-400 font-bold">No scratch cards yet. Place an order to unlock rewards!</p>
                      </div>
                    ) : (
                      scratchCards.map((card) => (
                        <div key={card.id} className="bg-gradient-to-r from-amber-600/20 via-orange-600/20 to-yellow-600/20 border border-amber-500/50 p-4 rounded-3xl shadow-xl flex justify-between items-center relative overflow-hidden">
                          <div className="space-y-1">
                            <span className="bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase">* Mystery Scratch Card</span>
                            <p className="text-xs font-black text-white mt-1">Unlocked on: {card.timestamp}</p>
                            <p className="text-[10px] text-slate-300 font-medium">
                              Status: {card.isScratched ? <b className="text-emerald-400">Claimed (₹{card.amount})</b> : <b className="text-amber-400">Unscratched (Waiting for you!)</b>}
                            </p>
                          </div>

                          {!card.isScratched ? (
                            <button 
                              onClick={() => {
                                setActiveScratchCard(card);
                                setScratchProgress(0);
                              }}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2.5 rounded-2xl font-black text-xs shadow-lg cursor-pointer transition"
                            >
                              Scratch Now ✨
                            </button>
                          ) : (
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl font-black text-xs">
                              ₹{card.amount} Added ✓
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : activeTab === 'home' && !selectedCategory ? (
                <div className="space-y-4 pb-4">
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Explore Categories</h3>
                      <span className="text-[10px] text-[#fc8019] font-bold">Ichapuram Specials</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { name: 'Food', icon: '🍚', desc: 'Biryani & Tiffins', lightBg: 'bg-amber-50 border-amber-300 text-slate-900', darkBg: 'bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-900 border-amber-500/50 text-white', accent: 'bg-amber-500' },
                        { name: 'Grocery', icon: '🛒', desc: 'Daily Essentials', lightBg: 'bg-emerald-50 border-emerald-300 text-slate-900', darkBg: 'bg-gradient-to-br from-emerald-500/20 via-slate-900 to-slate-900 border-emerald-500/50 text-white', accent: 'bg-emerald-500' },
                        { name: 'Meat & Fish', icon: '🥩', desc: 'Chicken, Mutton & Fish', lightBg: 'bg-rose-50 border-rose-300 text-slate-900', darkBg: 'bg-gradient-to-br from-rose-500/20 via-slate-900 to-slate-900 border-rose-500/50 text-white', accent: 'bg-rose-500' }
                      ].map(cat => (
                        <button 
                          key={cat.name} 
                          onClick={() => setSelectedCategory(cat.name)} 
                          className={`relative group overflow-hidden border-2 p-3.5 rounded-[28px] flex flex-col items-center text-center shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer backdrop-blur-xl ${
                            darkMode ? cat.darkBg : cat.lightBg
                          }`}
                        >
                          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform duration-300 border border-gray-200 dark:border-slate-700">
                            {cat.icon}
                          </div>
                          <span className={`text-xs font-black tracking-tight group-hover:text-[#fc8019] transition-colors ${darkMode ? 'text-white' : 'text-gray-900'}`}>{cat.name}</span>
                          <div className={`w-3 h-1 rounded-full ${cat.accent} mt-2 group-hover:w-6 transition-all duration-300`}></div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1 pt-1">
                    {['All', '🔥 Trending', '⚡ Fast Delivery', '⭐ Top Rated'].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setQuickFilter(filter)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black whitespace-nowrap transition-all duration-300 cursor-pointer border shadow-sm ${
                          quickFilter === filter
                            ? 'bg-gradient-to-r from-[#fc8019] to-amber-500 text-slate-950 border-amber-400 shadow-orange-500/20'
                            : darkMode ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-white border-gray-200 text-gray-700'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>

                  {backendOrders.length > 0 && (() => {
                    const latestOrder = backendOrders[0];
                    return (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Recent Order Status</h3>
                          <span className="text-[10px] text-amber-400 font-bold animate-pulse">Tap to track 🛵</span>
                        </div>

                        <div 
                          onClick={() => setActiveTrackingOrder(latestOrder)}
                          className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-emerald-500/40 p-3.5 rounded-3xl shadow-xl shadow-emerald-500/10 cursor-pointer transform hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group backdrop-blur-md"
                        >
                          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>

                          <div className="flex justify-between items-center relative z-10">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse">
                                  ● {latestOrder.status || 'Pending Approval'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">{latestOrder.orderId || `#ORD-${latestOrder.id}`}</span>
                              </div>
                              <h4 className="text-xs font-black text-white">{latestOrder.shopName || latestOrder.shop}</h4>
                              <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{latestOrder.items}</p>
                            </div>

                            <div className="text-right space-y-1.5 flex flex-col items-end">
                              <span className="text-xs font-black text-[#fc8019]">₹{latestOrder.totalAmount || latestOrder.total}</span>
                              
                              {unreadOrderCount > 0 && (
                                <span className="bg-red-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full animate-bounce shadow-md">
                                  💬 {unreadOrderCount} New
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 p-4 rounded-3xl text-white shadow-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-amber-400 tracking-wider">⚡ Super Fast Delivery</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">Available</span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium">Get your hot food, groceries & meat delivered at your doorstep within 15-20 minutes in Ichapuram!</p>
                  </div>

                  <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-800 shadow-purple-500/20 p-4 rounded-3xl text-white shadow-xl shadow-orange-500/20 border border-white/20 transform hover:scale-[1.02] transition-transform">
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-2xl"></div>
                    <div className="flex justify-between items-center relative z-10">
                      <div className="space-y-1">
                        <span className="bg-white/20 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">Special Offer</span>
                        <p className="font-black text-base tracking-tight mt-1">🎉 Ichapuram Food Fest</p>
                        <p className="text-[11px] opacity-90 font-medium">20% OFF on local tiffins & meals!</p>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-white/25 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner border border-white/30">🍕</div>
                    </div>
                  </div>
                </div>
              ) : selectedCategory && !selectedShop ? (
                <div className="space-y-4 animate-fadeIn pb-12">
                  <div className="flex items-center justify-between px-1">
                    <button onClick={() => setSelectedCategory(null)} className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition cursor-pointer">
                      <ArrowLeft size={14} /> Back to Categories
                    </button>
                    <span className="text-[10px] bg-[#fc8019]/20 text-[#fc8019] border border-[#fc8019]/30 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                      Ichapuram Zone 📍
                    </span>
                  </div>

                  <div className="space-y-1 px-1">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      Available {selectedCategory} Stores
                    </h3>
                  </div>

                  {selectedCategory === 'Food' && (
                    <div className="flex items-center gap-2 px-1 overflow-x-auto pb-1">
                      {[
                        { label: '🌟 All Food', val: 'All' },
                        { label: '🟢 Pure Veg', val: 'Veg' },
                        { label: '🔴 Non-Veg', val: 'Non-Veg' }
                      ].map((tab) => (
                        <button
                          key={tab.val}
                          onClick={() => setFoodTypeFilter(tab.val)}
                          className={`px-4 py-2 rounded-full text-xs font-black transition-all duration-300 cursor-pointer border shadow-sm shrink-0 ${
                            foodTypeFilter === tab.val
                              ? 'bg-gradient-to-r from-[#fc8019] to-amber-500 text-slate-950 border-amber-400 shadow-orange-500/25 scale-105'
                              : darkMode ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-white border-gray-200 text-gray-700'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3.5">
                    {dynamicShops
                      .filter(shop => {
                        if (selectedCategory === 'Food' && foodTypeFilter === 'Veg') {
                          return (shop.category || '').toLowerCase().includes('veg') || (shop.name || '').toLowerCase().includes('tiffen') || (shop.name || '').toLowerCase().includes('veg');
                        }
                        if (selectedCategory === 'Food' && foodTypeFilter === 'Non-Veg') {
                          return (shop.category || '').toLowerCase().includes('non') || (shop.name || '').toLowerCase().includes('biryani') || (shop.name || '').toLowerCase().includes('mutton') || (shop.name || '').toLowerCase().includes('chicken');
                        }
                        return true;
                      })
                      .length === 0 ? (
                      <div className="text-center py-20 bg-slate-900/60 rounded-[32px] border border-slate-800 space-y-2">
                        <span className="text-4xl">🏪</span>
                        <p className="text-xs text-slate-400 font-bold">No {selectedCategory} stores found right now.</p>
                      </div>
                    ) : (
                      dynamicShops
                        .filter(shop => {
                          if (selectedCategory === 'Food' && foodTypeFilter === 'Veg') {
                            return (shop.category || '').toLowerCase().includes('veg') || (shop.name || '').toLowerCase().includes('tiffen') || (shop.name || '').toLowerCase().includes('veg');
                          }
                          if (selectedCategory === 'Food' && foodTypeFilter === 'Non-Veg') {
                            return (shop.category || '').toLowerCase().includes('non') || (shop.name || '').toLowerCase().includes('biryani') || (shop.name || '').toLowerCase().includes('mutton') || (shop.name || '').toLowerCase().includes('chicken');
                          }
                          return true;
                        })
                        .map(shop => (
                          <div 
                            key={shop.id} 
                            onClick={() => setSelectedShop(shop)} 
                            className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-700/80 rounded-[30px] overflow-hidden shadow-xl shadow-black/30 cursor-pointer group hover:border-[#fc8019] transition-all duration-300 transform hover:scale-[1.01] relative"
                          >
                            <div className="absolute top-0 right-0 w-28 h-28 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all"></div>

                            <div className="w-full h-36 relative overflow-hidden bg-slate-950">
                              <img 
                                src={shop.imageUrl} 
                                alt={shop.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90" 
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>

                              <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-10">
                                <span className="bg-slate-950/80 backdrop-blur-md text-amber-400 border border-amber-500/30 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow">
                                  ⚡ {shop.time || '15-20 mins'}
                                </span>
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    toggleFavorite(shop); 
                                  }} 
                                  className="w-9 h-9 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-700 flex items-center justify-center text-sm shadow transition hover:scale-110 cursor-pointer"
                                >
                                  {favorites.some(f => f.id === shop.id) ? '❤️' : '🤍'}
                                </button>
                              </div>

                              <div className="absolute bottom-3 left-4 right-4 z-10 flex justify-between items-end">
                                <div className="space-y-0.5">
                                  <h4 className="text-sm font-black text-white group-hover:text-[#fc8019] transition-colors drop-shadow">
                                    {shop.name}
                                  </h4>
                                  <p className="text-[10px] text-slate-300 font-medium truncate max-w-[220px]">
                                    {shop.address}
                                  </p>
                                </div>
                                
                                <div className="bg-emerald-600 text-white text-[11px] font-black px-2.5 py-1 rounded-xl shadow-lg flex items-center gap-1 shrink-0 border border-emerald-400/30">
                                  <span>★</span> {shop.rating.replace(' ⭐', '')}
                                </div>
                              </div>
                            </div>

                            <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                              <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                                {shop.category || selectedCategory} • Open Now
                              </span>
                              <div className="flex items-center gap-1 text-[#fc8019] font-black group-hover:translate-x-1 transition-transform">
                                <span>Explore Menu</span>
                                <ChevronRight size={14} />
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              ) : selectedCategory && selectedShop ? (
                <div className="space-y-4 animate-fadeIn pb-16">
                  <button onClick={() => setSelectedShop(null)} className="text-xs font-bold text-slate-400 flex items-center gap-1 hover:text-white transition cursor-pointer">
                    <ArrowLeft size={14} /> Back to Shops
                  </button>

                  {/* --- RENDER AUTO-SLIDING BANNER USING SUB-COMPONENT --- */}
                  <ShopBannerSlider selectedShop={selectedShop} />

                  {Object.keys(selectedShop.categories).length === 0 ? (
                    <div className="text-center py-16 space-y-2">
                      <span className="text-3xl">🍽️</span>
                      <p className="text-xs text-slate-400 font-bold">No menu items available in this shop yet.</p>
                    </div>
                  ) : (
                    Object.entries(selectedShop.categories).map(([categoryName, itemsList]) => (
                      <div key={categoryName} className="space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#fc8019]"></span>
                          <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">{categoryName} ({itemsList.length})</h4>
                        </div>

                        <div className="space-y-2.5">
                          {itemsList.map((item, index) => {
                            const itemName = item.itemName || item.name || 'Item';
                            const itemPrice = item.price || 0;
                            const itemId = item.id || index;
                            const itemImage = item.imageUrl && item.imageUrl.trim() !== '' ? item.imageUrl : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';
                            const cartItem = cart.find(c => c.id === itemId);

                            return (
                              <div key={itemId} className="bg-slate-900 border border-slate-800/80 p-3 rounded-2xl flex items-center justify-between gap-3 shadow-lg hover:border-amber-500/50 transition-all group">
                                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-700 shadow-inner">
                                  <img src={itemImage} alt={itemName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                </div>

                                <div className="flex-1 min-w-0 space-y-1">
                                  <p className="font-black text-xs text-white truncate">{itemName}</p>
                                  <p className="text-[#fc8019] font-black text-xs">₹{itemPrice}</p>
                                  <span className="text-[9px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md font-bold">Fresh & Tasty</span>
                                </div>

                                {cartItem ? (
                                  <div className="flex items-center bg-gradient-to-r from-[#fc8019] to-amber-500 text-slate-950 rounded-xl px-3 py-1.5 gap-2 font-black shrink-0 text-xs shadow-md">
                                    <button onClick={() => setCart(cart.map(c => c.id === itemId ? {...c, qty: c.qty - 1} : c).filter(c => c.qty > 0))}><Minus size={13}/></button>
                                    <span>{cartItem.qty}</span>
                                    <button onClick={() => setCart(cart.map(c => c.id === itemId ? {...c, qty: c.qty + 1} : c))}><Plus size={13}/></button>
                                  </div>
                                ) : (
                                  <button onClick={() => setCart([...cart, { id: itemId, name: itemName, price: itemPrice, qty: 1 }])} className="bg-slate-800 hover:bg-[#fc8019] text-[#fc8019] hover:text-slate-950 border border-slate-700 px-3.5 py-2 rounded-xl font-black text-xs shrink-0 transition-all shadow-md cursor-pointer">
                                    ADD +
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : activeTab === 'wallet' ? (
                <div className="space-y-4 text-xs">
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 rounded-3xl text-white shadow-xl shadow-orange-500/20 space-y-2">
                    <p className="text-[9px] uppercase font-bold opacity-90 tracking-wider">Wallet Balance (Real-Time)</p>
                    <h2 className="text-2xl font-black">₹{walletBalance.toFixed(2)}</h2>
                    <button onClick={() => setIsAddMoneyModalOpen(true)} className="w-full bg-slate-900 hover:bg-slate-950 text-white py-3 rounded-2xl font-black text-xs shadow-md mt-2 flex items-center justify-center gap-1.5 cursor-pointer transition"><Plus size={15} /> Add Money 💳</button>
                  </div>

                  <div className="pt-1">
                    <button onClick={() => setIsWalletHistoryOpen(true)} className="w-full bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-amber-500/40 p-4 rounded-3xl shadow-xl flex justify-between items-center cursor-pointer group hover:border-amber-500 transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-base shadow-inner">📜</div>
                        <div className="text-left">
                          <h4 className="text-xs font-black text-white group-hover:text-amber-400 transition-colors">Wallet History</h4>
                          <p className="text-[10px] text-slate-400">View all past credits & debits</p>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                        <ChevronRight size={16} />
                      </div>
                    </button>
                  </div>
                </div>
              ) : activeTab === 'history' ? (
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <h3 className="font-black text-gray-400 uppercase">My Orders & Live Status (Latest on Top)</h3>
                    <button onClick={() => { const userMob = phone || localStorage.getItem('userMobile'); if (userMob) { fetch(`${API_BASE_URL}/api/orders/customer/${userMob}`).then(res => res.json()).then(data => setBackendOrders(data)); toast.success('Refreshed!'); } }} className="text-[10px] bg-slate-800 text-amber-400 px-2.5 py-1 rounded-lg border border-slate-700">Refresh 🔄</button>
                  </div>

                  {backendOrders.length === 0 ? (
                    <div className="text-center py-16 text-xs text-gray-400">📦 No active or past orders found.</div>
                  ) : (
                    backendOrders.map((ord, i) => (
                      <div key={i} className={`${darkMode ? 'bg-gradient-to-br from-slate-800 to-slate-850 border-slate-700/80 shadow-xl shadow-black/20' : 'bg-white border-gray-200 shadow-md'} p-4 rounded-3xl border space-y-2.5 transform hover:scale-[1.01] transition-all`}>
                        <div className="flex justify-between items-center font-black">
                          <span className="text-amber-400">{ord.orderId || `#ORD-${ord.id}`}</span>
                          <div className="flex items-center gap-2">
                            {((ord.status || '').toLowerCase().includes('out for delivery') || ord.deliveryOtp || ord.delivery_otp) && (
                              <span className="bg-amber-500/20 border border-amber-500 text-amber-300 text-[10px] px-2.5 py-0.5 rounded-xl font-black tracking-wider shadow-inner">
                                OTP: {ord.deliveryOtp || ord.delivery_otp || '----'}
                              </span>
                            )}
                            <span className="text-[#fc8019] text-sm">₹{ord.totalAmount || ord.total}</span>
                          </div>
                        </div>

                        <p className="text-slate-300 font-medium"><b>Shop:</b> {ord.shopName || ord.shop}</p>
                        <p className="text-slate-400 text-[11px]"><b>Items:</b> {ord.items}</p>
                        
                        <div className="flex justify-between items-center pt-2 border-t border-slate-700/60 text-[11px]">
                          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold animate-pulse">
                            ● {ord.status}
                          </span>
                          <div className="flex gap-2">
                            <button onClick={() => setActiveTrackingOrder(ord)} className="bg-gradient-to-r from-[#fc8019] to-amber-500 text-slate-950 px-3 py-1.5 rounded-xl font-black flex items-center gap-1 shadow-md">
                              <span>🛵 Track</span>
                            </button>
                            <button onClick={() => setRatingModal(ord.id)} className="bg-slate-700 text-amber-400 px-2.5 py-1 rounded-bold">Rate</button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : activeTab === 'profile' ? (
                <div className="space-y-4 text-xs animate-fadeIn pb-12">
                  <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-700/80 p-5 rounded-[32px] shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-28 h-28 bg-[#fc8019]/10 rounded-full blur-2xl"></div>
                    
                    <div className="flex items-center gap-4 relative z-10">
                      <img src={userPhoto} alt="Profile" className="w-16 h-16 rounded-2xl border-2 border-[#fc8019] object-cover shadow-lg shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="font-black text-base text-white truncate">{address.name || 'Foodiee User'}</h3>
                        <p className="text-slate-400 text-xs font-bold">+91 {address.mobile || phone || localStorage.getItem('userMobile')}</p>
                        <button 
                          onClick={() => {
                            setEditProfileName(address.name || '');
                            setIsEditProfileModalOpen(true);
                          }} 
                          className="text-[10px] text-[#fc8019] font-black underline cursor-pointer hover:text-orange-400"
                        >
                          Edit Profile Details ✏️
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div onClick={() => setActiveTab('history')} className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl text-center space-y-1 cursor-pointer hover:border-[#fc8019] transition">
                      <span className="text-lg">📦</span>
                      <p className="font-black text-white text-[11px]">Orders</p>
                      <p className="text-[9px] text-slate-400">Past & Live</p>
                    </div>

                    <div onClick={() => setActiveTab('wallet')} className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl text-center space-y-1 cursor-pointer hover:border-[#fc8019] transition">
                      <span className="text-lg">💰</span>
                      <p className="font-black text-white text-[11px]">Wallet</p>
                      <p className="text-[9px] text-emerald-400 font-bold">₹{walletBalance.toFixed(0)}</p>
                    </div>

                    <div onClick={() => setActiveTab('favorites')} className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl text-center space-y-1 cursor-pointer hover:border-[#fc8019] transition">
                      <span className="text-lg">❤️</span>
                      <p className="font-black text-white text-[11px]">Favorites</p>
                      <p className="text-[9px] text-slate-400">{favorites.length} Saved</p>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-[32px] p-3 space-y-1 shadow-lg">
                    <button onClick={() => setActiveTab('address')} className="w-full flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-800/80 transition cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-[#fc8019] flex items-center justify-center font-bold text-sm">📍</div>
                        <div className="text-left">
                          <p className="font-black text-white text-xs">Addresses</p>
                          <p className="text-[10px] text-slate-400">Share, edit & add new delivery locations</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                    </button>

                    <button onClick={() => setIsWalletHistoryOpen(true)} className="w-full flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-800/80 transition cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">📜</div>
                        <div className="text-left">
                          <p className="font-black text-white text-xs">Payment & Wallet History</p>
                          <p className="text-[10px] text-slate-400">View transaction records & refunds</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                    </button>

                    <button onClick={() => setActiveTab('offers')} className="w-full flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-800/80 transition cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">🎁</div>
                        <div className="text-left">
                          <p className="font-black text-white text-xs">* Offers & Rewards</p>
                          <p className="text-[10px] text-slate-400">Scratch cards hub & coupons</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                    </button>
                  </div>

                  <div className="pt-1">
                    <button 
                      onClick={() => { setIsLoggedIn(false); setStep(1); setOtpInput(''); }} 
                      className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 py-4 rounded-2xl font-black text-xs shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <LogOut size={16} /> Logout from Foodiee
                    </button>
                  </div>
                </div>
              ) : null}

            </main>

            {/* FLOATING PROCEED TO PAY BAR */}
            {!isPaymentScreen && !activeTrackingOrder && selectedCategory !== 'Print' && cart.length > 0 && (
              <div className="absolute bottom-14 inset-x-0 p-3 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 z-40 shadow-2xl">
                <div className="bg-slate-950 text-white p-2.5 rounded-2xl flex justify-between items-center shadow-inner border border-slate-800">
                  <div>
                    <p className="text-[9px] text-slate-400 font-extrabold uppercase">{cart.reduce((a, b) => a + b.qty, 0)} Items Added</p>
                    <p className="text-xs font-black text-[#fc8019]">₹{subtotal + deliveryFee}</p>
                  </div>
                  <button onClick={() => setIsPaymentScreen(true)} className="bg-gradient-to-r from-[#fc8019] to-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1 shadow-md">
                    <span>Proceed to Pay</span> <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* FIXED BOTTOM NAVIGATION BAR */}
            <nav className={`absolute bottom-0 inset-x-0 h-14 ${darkMode ? 'bg-slate-800/95 border-slate-700 text-slate-400' : 'bg-white/95 border-gray-200 text-gray-500'} backdrop-blur-md border-t flex justify-around items-center px-1 z-50 text-[10px] font-bold`}>
              <button onClick={() => { setActiveTab('home'); setSelectedCategory(null); setSelectedShop(null); setIsPaymentScreen(false); setActiveTrackingOrder(null); }} className={`flex flex-col items-center gap-0.5 transition ${activeTab === 'home' ? 'text-[#fc8019] scale-105' : 'hover:text-white'}`}>
                <ShoppingBag size={18} /><span>Home</span>
              </button>
              <button onClick={() => { setActiveTab('history'); setSelectedCategory(null); setSelectedShop(null); setIsPaymentScreen(false); setActiveTrackingOrder(null); }} className={`flex flex-col items-center gap-0.5 transition ${activeTab === 'history' ? 'text-[#fc8019] scale-105' : 'hover:text-white'}`}>
                <Clock size={18} /><span>History</span>
              </button>
              <button onClick={() => { setActiveTab('wallet'); setSelectedCategory(null); setSelectedShop(null); setIsPaymentScreen(false); setActiveTrackingOrder(null); }} className={`flex flex-col items-center gap-0.5 transition ${activeTab === 'wallet' ? 'text-[#fc8019] scale-105' : 'hover:text-white'}`}>
                <Wallet size={18} /><span>Wallet</span>
              </button>
              <button onClick={() => { setActiveTab('profile'); setSelectedCategory(null); setSelectedShop(null); setIsPaymentScreen(false); setActiveTrackingOrder(null); }} className={`flex flex-col items-center gap-0.5 transition ${activeTab === 'profile' ? 'text-[#fc8019] scale-105' : 'hover:text-white'}`}>
                <User size={18} /><span>Profile</span>
              </button>
            </nav>

          </div>
        )}

      </div>
    </div>
  );
}