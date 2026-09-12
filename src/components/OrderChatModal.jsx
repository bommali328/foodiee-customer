import React, { useState, useEffect, useRef, Component } from 'react';
import { Send, X, MessageSquare } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import toast from 'react-hot-toast';

// ✅ BASE URL UPDATE (AWS)
const API_BASE_URL = "http://Foodiee-backend-env.eba-5d9p6wzb.eu-north-1.elasticbeanstalk.com";

export default function OrderChatModal({ orderId, userMobile, userRole, recipientRole, orderStatus, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // 1. పాత చాట్ హిస్టరీ తెప్పించడం
    fetch(`${API_BASE_URL}/api/chat/history/${orderId}`)
      .then(res => res.json())
      .then(data => setMessages(data))
      .catch(err => console.error("Error fetching chat history", err));

    // 2. WebSocket లైవ్ సింక్ కనెక్షన్
    const socket = new SockJS(`${API_BASE_URL}/ws-foodiee`);
    const stompClient = new Client({
      webSocketFactory: () => socket,
      onConnect: () => {
        stompClient.subscribe(`/topic/chat/${orderId}`, (message) => {
          const incomingChat = JSON.parse(message.body);
          setMessages(prev => [...prev, incomingChat]);

          // వేరేవాళ్ళు మెసేజ్ పంపిస్తే నోటిఫికేషన్ & కౌంట్ పెంచడం
          if (incomingChat.senderType !== userRole) {
            toast(`💬 న్యూ మెసేజ్ వచ్చింది: ${incomingChat.senderName}`);
            setUnreadCount(prev => prev + 1);
          }
        });
      }
    });

    stompClient.activate();
    return () => stompClient.deactivate();
  }, [orderId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const chatPayload = {
      orderId: orderId,
      senderMobile: userMobile,
      senderName: userRole === 'customer' ? 'Customer' : userRole === 'partner' ? 'Delivery Partner' : 'Shop Owner',
      senderType: userRole,        // 'customer', 'partner', 'shop'
      recipientRole: recipientRole, // 'shop' లేదా 'partner'
      message: inputMessage
    };

    try {
      await fetch(`${API_BASE_URL}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatPayload)
      });
      setInputMessage('');
    } catch (err) {
      toast.error("మెసేజ్ పంపడం విఫలమైంది");
    }
  };

  return (
    <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-[#fc8019] w-full max-w-sm h-[500px] rounded-[32px] p-4 flex flex-col shadow-2xl text-white relative">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-black text-[#fc8019]">Chat ({recipientRole === 'shop' ? 'Shop Owner' : 'Delivery Partner'})</h3>
            <p className="text-[9px] text-slate-400">Order ID: {orderId} {unreadCount > 0 && `• ${unreadCount} New`}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Messages Box */}
        <div className="flex-1 overflow-y-auto bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2 text-xs my-2">
          {orderStatus === 'DELIVERED' || orderStatus === 'COMPLETED' ? (
            <div className="text-center py-10 text-slate-400 text-xs font-bold">
              🔒 ఆర్డర్ డెలివరీ అయింది. చాట్ సెషన్ ముగిసింది.
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-slate-500 text-[10px] py-20">
              💬 ఇంకా ఎలాంటి మెసేజ్‌లు లేవు.<br/>మాట్లాడటం ప్రారంభించండి!
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`p-2.5 rounded-xl max-w-[80%] ${msg.senderType === userRole ? 'bg-[#fc8019] text-slate-950 ml-auto font-bold' : 'bg-slate-800 text-white mr-auto'}`}>
                <p className="text-[8px] opacity-70 uppercase">{msg.senderName}</p>
                <p className="text-xs">{msg.message}</p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Box (డెలివరీ అయిపోతే డిసేబుల్ అవుతుంది) */}
        {orderStatus !== 'DELIVERED' && orderStatus !== 'COMPLETED' && (
          <div className="flex gap-2 pt-1">
            <input 
              type="text" 
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="మెసేజ్ టైప్ చేయండి..."
              className="flex-1 bg-slate-950 border border-slate-700 px-3 py-2.5 rounded-xl text-xs text-white outline-none"
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button onClick={handleSendMessage} className="bg-[#fc8019] hover:bg-[#e07015] text-slate-950 px-4 rounded-xl font-black text-xs cursor-pointer flex items-center justify-center">
              <Send size={14} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}