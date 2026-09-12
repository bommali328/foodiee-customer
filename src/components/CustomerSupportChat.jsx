import React, { useState, useEffect, useRef } from "react";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import axios from "axios";
import { Send, Image as ImageIcon, Paperclip, X, ShieldCheck } from "lucide-react";

// ✅ BASE URL UPDATE (AWS)
const API_BASE_URL = "http://Foodiee-backend-env.eba-5d9p6wzb.eu-north-1.elasticbeanstalk.com";

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
      .then((res) => setMessages(res.data))
      .catch((err) => console.error("Error fetching chat history", err));

    // 2. Connect WebSocket
    const socket = new SockJS(`${API_BASE_URL}/ws-foodiee`);
    const stompClient = Stomp.over(socket);
    stompClient.debug = () => {};
    stompClientRef.current = stompClient;

    stompClient.connect({}, () => {
      stompClient.subscribe(`/topic/chat/${mobileNumber}`, (messageOutput) => {
        const receivedMessage = JSON.parse(messageOutput.body);
        setMessages((prev) => [...prev, receivedMessage]);
      });
    });

    return () => {
      if (stompClientRef.current) stompClientRef.current.disconnect();
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

  const sendMessage = (e) => {
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
      senderType: "customer"
    };

    if (stompClientRef.current && stompClientRef.current.connected) {
      stompClientRef.current.send(`/app/send/${mobileNumber}`, {}, JSON.stringify(chatMessage));
      setMessageInput("");
      setSelectedFile(null);
    }
  };

  return (
    <div className="flex flex-col h-[550px] w-full max-w-md bg-slate-950 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl text-white font-sans">
      
      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#fc8019] to-amber-400 text-slate-950 flex items-center justify-center font-black shadow">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black text-white">Foodiee Live Support</h3>
            <p className="text-[10px] text-emerald-400 font-bold">● Online ({localStorage.getItem('userName') || currentUserName})</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer p-1">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Messages Window */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/70">
        {messages.length === 0 ? (
          <div className="text-center py-16 text-slate-500 space-y-1">
            <p className="text-xs font-bold">How can we help you today?</p>
            <p className="text-[10px]">Type your query below to chat with Foodiee Admin.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isCustomer = msg.senderType === 'customer';
            return (
              <div key={index} className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[75%] p-3 rounded-2xl text-xs shadow-md ${
                  isCustomer 
                    ? 'bg-[#fc8019] text-slate-950 rounded-br-none font-bold' 
                    : 'bg-slate-900 text-white rounded-bl-none border border-slate-800'
                }`}>
                  <span className={`block text-[9px] uppercase font-black mb-1 ${isCustomer ? 'text-slate-900' : 'text-[#fc8019]'}`}>
                    {isCustomer ? (localStorage.getItem('userName') || msg.senderName || 'Customer') : (msg.senderName || 'Super Admin')}
                  </span>
                  <div className="text-xs font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: msg.message }} />
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-amber-400 truncate max-w-[250px]">📎 {selectedFile.name}</span>
          <button onClick={() => setSelectedFile(null)} className="text-rose-400 font-bold cursor-pointer">Remove</button>
        </div>
      )}

      {/* Input Box */}
      <form onSubmit={sendMessage} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
        <label className="text-slate-400 hover:text-white cursor-pointer p-2 rounded-xl bg-slate-950 border border-slate-800">
          <Paperclip size={16} />
          <input type="file" onChange={handleFileUpload} className="hidden" accept="image/*,.pdf,.doc,.docx" />
        </label>
        
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white outline-none focus:border-[#fc8019] transition"
        />

        <button 
          type="submit" 
          className="bg-[#fc8019] hover:bg-amber-400 text-slate-950 px-4 py-2.5 rounded-xl font-black text-xs shadow cursor-pointer flex items-center gap-1 transition"
        >
          <Send size={14} /> Send
        </button>
      </form>
    </div>
  );
}