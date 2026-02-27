import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { getMessageRequests } from "@/actions/messages";
import { MessagesClient } from "@/components/messages/MessagesClient";

export default async function MessagesPage() {
  const requests = await getMessageRequests();
  return (
    <>
      <Header title="Messages" />
      <div className="p-4 md:p-6">
        <Suspense fallback={<div className="text-center text-gray-500 py-12">Loading...</div>}>
          <MessagesClient requests={JSON.parse(JSON.stringify(requests))} />
        </Suspense>
      </div>
    </>
  );
}
