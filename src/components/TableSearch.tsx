import Image from "next/image";

type TableSearchProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
};

const TableSearch = ({ value, onChange, placeholder = "Search..." }: TableSearchProps = {}) => {
  const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
    placeholder,
    className: "w-[200px] p-2 bg-transparent outline-none",
  };

  if (onChange) {
    inputProps.value = value ?? "";
    inputProps.onChange = (event) => onChange(event.target.value);
  } else if (value !== undefined) {
    inputProps.defaultValue = value;
  }

  return (
    <div className="w-full md:w-auto flex items-center gap-2 text-xs rounded-full ring-[1.5px] ring-gray-300 px-2">
      <Image src="/search.png" alt="" width={14} height={14} />
      <input {...inputProps} />
    </div>
  );
};

export default TableSearch;
