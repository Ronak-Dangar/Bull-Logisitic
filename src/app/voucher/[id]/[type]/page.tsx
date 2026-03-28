import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import VoucherPrintPage from "./VoucherPrintPage";

interface Props {
  params: Promise<{ id: string; type: "advance" | "final" }>;
}

export default async function VoucherPage({ params }: Props) {
  const session = await auth();
  if (!session) notFound();

  const { id, type } = await params;
  if (type !== "advance" && type !== "final") notFound();

  const delivery = await prisma.deliveryDetail.findUnique({
    where: { id },
    include: {
      masterRequest: {
        include: {
          childPickups: {
            orderBy: { stopSequence: "asc" },
            include: { center: { select: { centerName: true } } },
          },
        },
      },
      factory: { select: { factoryName: true, location: true } },
    },
  });

  if (!delivery) notFound();

  // For advance voucher, advance must exist
  if (type === "advance" && !delivery.advancePaid) notFound();
  // For final voucher, actuallyPaid must exist
  if (type === "final" && !delivery.actuallyPaid) notFound();

  const serialized = JSON.parse(JSON.stringify(delivery));

  return <VoucherPrintPage delivery={serialized} type={type} />;
}
