import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const { data: topics = [] } = useQuery({
    queryKey: ['allTopics'],
    queryFn: () => base44.entities.Topic.list(),
  });

  const filteredTopics = topics.filter(topic => 
    topic.name.toLowerCase().includes(search.toLowerCase()) ||
    topic.description?.toLowerCase().includes(search.toLowerCase()) ||
    topic.subject.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8);

  const handleSelect = (topic) => {
    navigate(createPageUrl(`Exercises?topic=${topic.id}`));
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600 hover:text-slate-800">
          <Search className="w-5 h-5" />
          <span className="text-sm">Hledat témata...</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[600px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Hledat témata..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Žádná témata nenalezena.</CommandEmpty>
            <CommandGroup heading="Témata">
              {filteredTopics.map((topic) => (
                <CommandItem
                  key={topic.id}
                  onSelect={() => handleSelect(topic)}
                  className="cursor-pointer"
                >
                  <div className="flex flex-col">
                    <div className="font-medium">{topic.name}</div>
                    <div className="text-xs text-slate-500">
                      {topic.subject} • {topic.grade}. třída
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}