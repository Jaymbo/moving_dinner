export function getJoinLink(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

export function getMyRole(group: any, currentUserId?: number): string {
  if (group.members) {
    const m = group.members.find(
      (mem: any) => mem.userId === currentUserId || mem.user?.id === currentUserId
    );
    if (m) return m.role;
  }
  return group.role || 'member';
}

export function isActualMember(group: any, currentUserId?: number): boolean {
  if (group.members) {
    return group.members.some(
      (mem: any) => mem.userId === currentUserId || mem.user?.id === currentUserId
    );
  }
  return false;
}
