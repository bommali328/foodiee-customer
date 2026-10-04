import React, { useState, useEffect, useRef } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import axios from "axios";
import { Send, Image as ImageIcon, Paperclip, X, ShieldCheck } from "lucide-react";

// ✅ Localhost Base URL
// పాతది తీసేసి ఇది పెట్టండి:
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://api.foodiee.shop";

export default function CustomerSupportChat({ customerMobile, customerName, onClose }) {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const stompClientRef = useRef(null);
  const messagesEndRef = useRef(null);

  const mobileNumber = customerMobile || localStorage.getItem('userMobile') || '9876543210';
  const currentUserName = customerName || localStorage.getItem('userName') || 'Customer';

  useEffect(() => {
    // 1. Fetch Chat History
    axios.get(`${API_BASE_URL}/api/chat/history/${mobileNumber}`)
      .then((res) => setMessages(res.data || []))
      .catch((err) => console.error("Error fetching chat history", err));

    // 2. Connect WebSocket using local endpoint
    const socket = new SockJS(`${API_BASE_URL}/ws-foodiee`);
    const stompClient = new Client({
      webSocketFactory: () => socket,
      debug: () => {},
      onConnect: () => {
        stompClient.subscribe(`/topic/chat/${mobileNumber}`, (messageOutput) => {
          const receivedMessage = JSON.parse(messageOutput.body);
          setMessages((prev) => {
            // ✅ Strict duplicate check to prevent double rendering
            const exists = prev.some(m => 
              m.message === receivedMessage.message && 
              m.timestamp === receivedMessage.timestamp &&
              m.senderType === receivedMessage.senderType
            );
            if (exists) return prev;
            return [...prev, receivedMessage];
          });
        });
      }
    });

    stompClient.activate();
    stompClientRef.current = stompClient;

    return () => {
      if (stompClientRef.current) stompClientRef.current.deactivate();
    };
  }, [mobileNumber]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFile({ name: file.name, url: reader.result, type: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() && !selectedFile) return;

    let messageContent = messageInput;
    if (selectedFile) {
      messageContent = `<div class="space-y-2"><p>${messageInput}</p>${selectedFile.type.includes('image') ? `<img src="${selectedFile.url}" class="rounded-xl max-h-40 object-cover" />` : `<a href="${selectedFile.url}" download="${selectedFile.name}" class="text-xs underline text-amber-300">📎 ${selectedFile.name}</a>`}</div>`;
    }

    const chatMessage = {
      senderMobile: mobileNumber,
      senderName: localStorage.getItem('userName') || currentUserName,
      message: messageContent,
      senderType: "customer",
      timestamp: new Date().toISOString()
    };

    try {
      // Send via REST (Backend saves to DB and broadcasts via WebSocket)
      await axios.post(`${API_BASE_URL}/api/chat/send`, chatMessage);

      // Publish via STOMP if connected
      if (stompClientRef.current && stompClientRef.current.connected) {
        stompClientRef.current.publish({
          destination: `/app/send/${mobileNumber}`,
          body: JSON.stringify(chatMessage)
        });
      }

      setMessageInput("");
      setSelectedFile(null);
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  // ✅ WhatsApp Style Date Grouping Logic (Today & Last Dates)
  const renderGroupedChatMessages = (messagesList) => {
    const todayStr = new Date().toLocaleDateString();
    
    const grouped = messagesList.reduce((acc, msg) => {
      const msgDate = msg.timestamp ? new Date(msg.timestamp).toLocaleDateString() : todayStr;
      const dateKey = msgDate === todayStr ? 'Today' : msgDate;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(msg);
      return acc;
    }, {});

    return Object.entries(grouped).map(([dateLabel, msgs], idx) => (
      <div key={idx} className="space-y-3">
        {/* Date Divider Badge */}
        <div className="flex justify-center my-3">
          <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full shadow-inner border border-slate-700 uppercase tracking-wider">
            {dateLabel}
          </span>
        </div>

        {msgs.map((msg, mIdx) => {
          const isCustomer = msg.senderType === 'customer';
          return (
            <div key={mIdx} className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'} space-y-0.5`}>
              <div className={`max-w-[80%] p-3 rounded-2xl text-xs shadow-md relative ${
                isCustomer 
                  ? 'bg-[#005c4b] text-white rounded-br-none font-bold' // WhatsApp Outgoing Dark Teal
                  : 'bg-[#202c33] text-white rounded-bl-none border border-slate-700/50' // WhatsApp Incoming Dark Gray
              }`}>
                <span className={`block text-[9px] uppercase font-black mb-1 ${isCustomer ? 'text-emerald-300' : 'text-[#fc8019]'}`}>
                  {isCustomer ? (localStorage.getItem('userName') || msg.senderName || 'Customer') : (msg.senderName || 'Super Admin')}
                </span>
                <div className="text-xs font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: msg.message }} />
                <span className="block text-[8px] text-slate-400 text-right mt-1">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    ));
  };

  return (
    <div className="flex flex-col h-[550px] w-full max-w-md bg-[#0b141a] border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl text-white font-sans">
      
      {/* Header (WhatsApp Style Dark Green) */}
      <div className="p-4 bg-[#202c33] border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#00a884] text-white flex items-center justify-center font-black shadow">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="text-xs font-black text-white">Foodiee WhatsApp Support</h3>
            <p className="text-[10px] text-emerald-400 font-bold">● Online ({localStorage.getItem('userName') || currentUserName})</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer p-1">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Messages Window (WhatsApp Dotted Background Pattern) */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[radial-gradient(#111b21_1px,transparent_1px)] [background-size:16px_16px]">
        {messages.length === 0 ? (
          <div className="text-center py-20 text-slate-500 space-y-1">
            <p className="text-xs font-bold">How can we help you today?</p>
            <p className="text-[10px]">Type your query below to chat with Foodiee Admin.</p>
          </div>
        ) : (
          renderGroupedChatMessages(messages)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="px-4 py-2 bg-[#202c33] border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-amber-400 truncate max-w-[250px]">📎 {selectedFile.name}</span>
          <button onClick={() => setSelectedFile(null)} className="text-rose-400 font-bold cursor-pointer">Remove</button>
        </div>
      )}

      {/* Input Box (WhatsApp Style) */}
      <form onSubmit={sendMessage} className="p-3 bg-[#202c33] border-t border-slate-800 flex items-center gap-2">
        <label className="text-slate-400 hover:text-white cursor-pointer p-2.5 rounded-xl bg-[#2a3942] border border-slate-700/50">
          <Paperclip size={16} />
          <input type="file" onChange={handleFileUpload} className="hidden" accept="image/*,.pdf,.doc,.docx" />
        </label>
        
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-[#2a3942] border border-slate-700/50 px-4 py-3 rounded-xl text-xs font-bold text-white outline-none focus:border-[#00a884] transition"
        />

        <button 
          type="submit" 
          className="bg-[#00a884] hover:bg-[#008f72] text-white px-4 py-3 rounded-xl font-black text-xs shadow cursor-pointer flex items-center gap-1 transition"
        >
          <Send size={14} /> Send
        </button>
      </form>
    </div>
  );
}