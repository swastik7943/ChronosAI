import ChatWidget from '../components/Chat/ChatWidget';

export default function ChatPage({ token }) {
  return (
    <div className="flex-1 flex overflow-hidden p-4">
      <div className="flex-1 max-w-3xl mx-auto overflow-hidden">
        <ChatWidget onMeetingsChange={() => {}} />
      </div>
    </div>
  );
}
