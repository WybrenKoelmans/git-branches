import * as OS from "os";
import { Repository, Cred, Reference } from "nodegit";
import { default as fetch } from "node-fetch";

require('dotenv').config();

function credentials(_url: string, username: string) {
    console.log("getting credentials..");
    if (process.env['SSH_USE_AGENT'] === 'true') {
        return Cred.sshKeyFromAgent(username);
    }
    return Cred.sshKeyNew(
        username,
        process.env['SSH_KEY_PUBLIC'] || OS.homedir() + `\\.ssh\\id_rsa.pub`,
        process.env['SSH_KEY_PRIVATE'] || OS.homedir() + `\\.ssh\\id_rsa`,
        "",
    );
}

async function removeRemotes(branches: string[], repo: Repository) {
    const remotes = branches.filter(ref => ref.startsWith('refs/remotes/'));
    if (remotes.length > 0) {
        console.log('------------------------');
        console.log('Please remove these branches from your remotes:');
        remotes.map(async ref => {
            const branchName = ref.slice('refs/remotes/'.length);
            console.log(`${branchName}`);
        });
    }
}

async function main(): Promise<number> {
    const repo = await Repository.open(`${process.env['REPO']}`);

    console.log('Fetching and pruning remotes..');
    try {
        await repo.fetchAll({
            prune: 1, //Fetch.PRUNE,
            callbacks: {
                credentials,
            }
        });
    } catch (error) {
        console.error(`Could not fetch from remotes!`, error);
    }

    console.log('Done.');

    console.log('Getting IDs and TP status..');
    const references: string[] = await Reference.list(repo);
    const branches = references.filter(ref => ref.includes('#'));
    const miscBranches = references.filter(ref => !ref.includes('#')).filter(ref => ref.includes('refs/heads/'));
    const ids = branches.map(ref => {
        const match = ref.match(`#(\\d+)`);
        return match ? match[1] : null;
    });
    // console.log(ids);

    var url = `https://${process.env['TP_DOMAIN']}.tpondemand.com/api/v2/Assignable/?where=id in [${ids.join(',')}]&select={id,name,EntityState.isFinal,EntityState.name as state,name,EntityType.name as type}&take=1000&format=json&token=${process.env['TP_TOKEN']}`;
    try {
        const raw = await fetch(url);
        const response: {
            items: {
                id: number,
                name: string,
                isFinal: boolean,
                state: string,
                type: string
            }[]
        } = await raw.json();

        const itemsDone = response.items.filter(item => item.isFinal);
        const itemsNotDone = response.items.filter(item => !item.isFinal);

        console.log('------------------------');
        console.log('These branches are still relevant:');
        itemsNotDone.forEach(item => console.log(`[${item.state.padStart(12)}] ${item.type.substr(0, 1)}#${item.id.toString().padEnd(5)} ${item.name}`));

        const branchesDone = branches.filter(ref => {
            return itemsDone.some(item => ref.includes(`#${item.id}`));
        });
        // console.log(response.items);
        // console.log(itemsNotDone);
        // console.log(itemsDone);
        // console.log(branches);
        // console.log(result);

        console.log('------------------------');
        console.log('These branches are no longer relevant and to be removed:');
        branchesDone.filter(ref => ref.startsWith('refs/heads/')).map(ref => {
            console.log(`Removing '${ref}'`);
            const code = Reference.remove(repo, ref);
            if (code !== 0) {
                console.error(`Error removing '${ref}'`);
            }
        });

        await removeRemotes(branchesDone, repo);

        console.log('------------------------');
        console.log('These branches are not matched to anything on target process:');
        miscBranches.forEach(ref => console.log(ref.slice('refs/heads/'.length)));
    } catch (e) {
        console.log(e);
        return 1;
    }

    return 0;
}

const resultPromise = main();
resultPromise.then((result) => {
    process.exit(result);
});
