import React from "react";

const ProjectSkeleton = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="animate-pulse">
          {/* Image Box Skeleton */}
          <div className="aspect-[16/10] bg-zinc-100 border border-zinc-200" />

          {/* Meta Content Skeleton */}
          <div className="mt-4 flex justify-between items-start">
            <div className="h-4 w-1/2 bg-zinc-100 rounded-sm" />
            <div className="h-3 w-12 bg-zinc-50 rounded-sm" />
          </div>

          {/* Client Name Skeleton */}
          <div className="mt-2 flex items-center gap-2">
            <div className="w-4 h-[1px] bg-zinc-100"></div>
            <div className="h-2 w-20 bg-zinc-50 rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProjectSkeleton;
