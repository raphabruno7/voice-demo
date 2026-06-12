import QRCode from "qrcode";

interface QRCodeProps {
  phoneNumber: string;
  dict: { caption: string };
}

export default async function QRCodeImage({ phoneNumber, dict }: QRCodeProps) {
  const tel = `tel:${phoneNumber.replace(/\s/g, "")}`;
  const svg = await QRCode.toString(tel, {
    type: "svg",
    color: { dark: "#ffffff", light: "#00000000" },
    margin: 1,
    width: 160,
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-32 h-32"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-zinc-500 text-xs">{dict.caption}</p>
    </div>
  );
}
